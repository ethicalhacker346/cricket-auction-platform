import { auctionEventBus } from "./EventBus";
import type { AuctionSoundEvent } from "./types";

/**
 * AuctionAudioManager — fully synthesized, world-class auction sound engine.
 *
 * Why synthesis instead of audio files:
 *  - Zero asset/network dependency — can never 404, never buffers mid-auction.
 *  - Sample-accurate scheduling via AudioContext clock (no HTMLAudio latency
 *    or per-play element churn), layered partials, and a real master chain.
 *
 * Signal graph:
 *   voice → voiceGain ─┬─► masterGain ─► compressor ─► destination   (dry)
 *                      └─► convolver (generated IR) ─► reverbGain ─► masterGain (wet)
 *
 * The compressor keeps overlapping voices (bid spam + applause) from
 * clipping; the generated-impulse convolver gives every hit a room to live
 * in — the two things that make synthesized audio feel produced rather than
 * beepy.
 */

interface Options {
  masterVolume?: number;
  muted?: boolean;
}

const MUTE_KEY = "auction_audio_muted";

export class AuctionAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverb: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;

  private master: number;
  private _muted: boolean;
  private unlocked = false;
  private recent = new Map<string, number>();
  private unsub: (() => void) | null = null;
  private timerLastSecond = -1;
  private timerHadRun = false;

  constructor(options: Options = {}) {
    this.master = options.masterVolume ?? 0.85;
    this._muted =
      options.muted ??
      (typeof localStorage !== "undefined" &&
        JSON.parse(localStorage.getItem(MUTE_KEY) ?? "false"));

    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      this.ensureContext();
      if (this.ctx?.state === "suspended") void this.ctx.resume();
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", unlock);
    };
    if (typeof document !== "undefined") {
      document.addEventListener("click", unlock);
      document.addEventListener("touchstart", unlock);
      document.addEventListener("keydown", unlock);
    }

    this.unsub = auctionEventBus.on("*", (e) => this.onEvent(e));
  }

  /* ───────────────────────────── graph ───────────────────────────── */

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;

    this.ctx = new Ctor();

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.18;
    this.compressor.connect(this.ctx.destination);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._muted ? 0 : this.master;
    this.masterGain.connect(this.compressor);

    // Generated stereo impulse response — exponentially decaying noise,
    // ~1.6s tail. No reverb asset needed.
    const seconds = 1.6;
    const rate = this.ctx.sampleRate;
    const length = Math.floor(seconds * rate);
    const ir = this.ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
      const data = ir.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2.4);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
    }
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = ir;
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.32;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    return this.ctx;
  }

  /** Dry+wet voice bus. Returns null when audio can't run (muted/no ctx). */
  private bus(volume: number): { ctx: AudioContext; input: GainNode; t: number } | null {
    if (this._muted) return null;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.reverb) return null;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const input = ctx.createGain();
    input.gain.value = volume;
    input.connect(this.masterGain);
    input.connect(this.reverb);
    return { ctx, input, t: ctx.currentTime };
  }

  /* ──────────────────────── voice primitives ─────────────────────── */

  /** Enveloped oscillator: attack → exponential decay to silence. */
  private tone(
    bus: NonNullable<ReturnType<AuctionAudioManager["bus"]>>,
    opts: {
      type: OscillatorType;
      freq: number;
      freqEnd?: number;
      at?: number;
      attack?: number;
      decay: number;
      peak: number;
      detune?: number;
    },
  ) {
    const { ctx, input, t } = bus;
    const at = t + (opts.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.freq > 2000 ? "sine" : opts.type;
    osc.frequency.setValueAtTime(Math.max(20, opts.freq), at);
    if (opts.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), at + opts.decay * 0.9);
    }
    if (opts.detune) osc.detune.value = opts.detune;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(opts.peak, at + (opts.attack ?? 0.006));
    env.gain.exponentialRampToValueAtTime(0.0004, at + opts.decay);
    osc.connect(env).connect(input);
    osc.start(at);
    osc.stop(at + opts.decay + 0.05);
  }

  /** Shaped noise burst (percussion, applause, air). */
  private noise(
    bus: NonNullable<ReturnType<AuctionAudioManager["bus"]>>,
    opts: {
      at?: number;
      duration: number;
      peak: number;
      filterType: BiquadFilterType;
      frequency: number;
      frequencyEnd?: number;
      q?: number;
      attack?: number;
    },
  ) {
    const { ctx, input, t } = bus;
    const at = t + (opts.at ?? 0);
    const length = Math.max(1, Math.floor(ctx.sampleRate * opts.duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType;
    filter.frequency.setValueAtTime(opts.frequency, at);
    if (opts.frequencyEnd) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, opts.frequencyEnd), at + opts.duration);
    }
    filter.Q.value = opts.q ?? 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(opts.peak, at + (opts.attack ?? 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0004, at + opts.duration);
    src.connect(filter).connect(gain).connect(input);
    src.start(at);
    src.stop(at + opts.duration + 0.05);
  }

  /** FM bell — carrier + modulator with decaying modulation index. */
  private bell(
    bus: NonNullable<ReturnType<AuctionAudioManager["bus"]>>,
    opts: { carrier: number; ratio?: number; at?: number; decay: number; peak: number },
  ) {
    const { ctx, input, t } = bus;
    const at = t + (opts.at ?? 0);
    const ratio = opts.ratio ?? 2.76; // inharmonic — bell-like partials
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const amp = ctx.createGain();
    carrier.frequency.value = opts.carrier;
    modulator.frequency.value = opts.carrier * ratio;
    modGain.gain.setValueAtTime(opts.carrier * 2.4, at);
    modGain.gain.exponentialRampToValueAtTime(1, at + opts.decay * 0.8);
    modulator.connect(modGain).connect(carrier.frequency);
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(opts.peak, at + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0004, at + opts.decay);
    carrier.connect(amp).connect(input);
    carrier.start(at);
    modulator.start(at);
    carrier.stop(at + opts.decay + 0.05);
    modulator.stop(at + opts.decay + 0.05);
  }

  /* ─────────────────────────── voices ────────────────────────────── */

  /** Paddle tap + coin shimmer. First bid of a lot gets a brighter ring. */
  private playBid(isFirstBid: boolean) {
    const bus = this.bus(0.9);
    if (!bus) return;
    // wooden paddle "thock"
    this.tone(bus, { type: "triangle", freq: 190, freqEnd: 120, decay: 0.09, peak: 0.55 });
    this.noise(bus, { duration: 0.03, peak: 0.3, filterType: "bandpass", frequency: 2600, q: 6 });
    // coin shimmer
    this.tone(bus, { type: "sine", freq: 1568, decay: 0.4, peak: 0.16, at: 0.015 });
    this.tone(bus, { type: "sine", freq: 2093, decay: 0.5, peak: 0.1, at: 0.03 });
    if (isFirstBid) {
      // "we're underway" — brighter opening bell layered in
      this.bell(bus, { carrier: 880, at: 0.02, decay: 0.9, peak: 0.14 });
    }
  }

  /** Auctioneer invites the lot — a long, warm FM bell. */
  private playLotOpened() {
    const bus = this.bus(0.8);
    if (!bus) return;
    this.bell(bus, { carrier: 587.33, decay: 2.0, peak: 0.34 });
    this.bell(bus, { carrier: 1174.66, decay: 1.2, peak: 0.1, at: 0.01 });
    this.noise(bus, { duration: 0.04, peak: 0.14, filterType: "highpass", frequency: 4000 });
  }

  /** The hammer falls: gavel slam → applause swell → major fanfare. */
  private playSold() {
    const bus = this.bus(1.0);
    if (!bus) return;
    // Gavel: low body thump + crack + room
    this.tone(bus, { type: "sine", freq: 95, freqEnd: 52, decay: 0.22, peak: 0.9 });
    this.noise(bus, { duration: 0.12, peak: 0.55, filterType: "lowpass", frequency: 480, q: 0.8 });
    this.noise(bus, { duration: 0.03, peak: 0.4, filterType: "bandpass", frequency: 2100, q: 4 });
    // second lighter rap
    this.tone(bus, { type: "triangle", freq: 220, freqEnd: 130, decay: 0.11, peak: 0.34, at: 0.13 });
    // applause: shaped mid-band noise swell
    this.noise(bus, {
      at: 0.28, duration: 1.15, peak: 0.32, attack: 0.22,
      filterType: "bandpass", frequency: 1100, frequencyEnd: 1600, q: 0.6,
    });
    this.noise(bus, {
      at: 0.34, duration: 0.9, peak: 0.18, attack: 0.2,
      filterType: "highpass", frequency: 5200,
    });
    // fanfare triad C5–E5–G5–C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this.tone(bus, { type: "triangle", freq, decay: 0.5, peak: 0.16, at: 0.32 + i * 0.085 });
      this.tone(bus, { type: "sine", freq: freq * 2, decay: 0.3, peak: 0.05, at: 0.32 + i * 0.085 });
    });
  }

  /** No sale — descending detuned sigh + soft floor thud. */
  private playUnsold() {
    const bus = this.bus(0.85);
    if (!bus) return;
    this.tone(bus, { type: "sawtooth", freq: 220, freqEnd: 158, decay: 0.55, peak: 0.16, detune: -7 });
    this.tone(bus, { type: "sawtooth", freq: 220, freqEnd: 155, decay: 0.55, peak: 0.16, detune: 7 });
    this.tone(bus, { type: "sine", freq: 110, freqEnd: 78, decay: 0.5, peak: 0.3 });
    this.noise(bus, { at: 0.32, duration: 0.3, peak: 0.14, filterType: "lowpass", frequency: 300 });
  }

  /** Opening ceremony: riser → impact → ascending flourish. */
  private playAuctionStarted() {
    const bus = this.bus(0.85);
    if (!bus) return;
    this.tone(bus, { type: "sawtooth", freq: 160, freqEnd: 640, decay: 0.7, peak: 0.12, attack: 0.35 });
    this.noise(bus, { duration: 0.7, peak: 0.1, attack: 0.4, filterType: "bandpass", frequency: 500, frequencyEnd: 3200, q: 1.4 });
    // impact
    this.tone(bus, { type: "sine", freq: 100, freqEnd: 48, decay: 0.3, peak: 0.7, at: 0.68 });
    this.noise(bus, { at: 0.68, duration: 0.25, peak: 0.4, filterType: "lowpass", frequency: 900 });
    const flourish = [392, 523.25, 659.25, 783.99];
    flourish.forEach((freq, i) => this.bell(bus, { carrier: freq, at: 0.75 + i * 0.1, decay: 1.1, peak: 0.12 }));
  }

  private playPaused() {
    const bus = this.bus(0.7);
    if (!bus) return;
    this.bell(bus, { carrier: 659.25, decay: 0.9, peak: 0.16 });
    this.bell(bus, { carrier: 523.25, decay: 1.2, peak: 0.14, at: 0.16 });
  }

  private playResumed() {
    const bus = this.bus(0.75);
    if (!bus) return;
    this.bell(bus, { carrier: 523.25, decay: 0.8, peak: 0.14 });
    this.bell(bus, { carrier: 659.25, decay: 0.9, peak: 0.15, at: 0.1 });
    this.bell(bus, { carrier: 783.99, decay: 1.3, peak: 0.16, at: 0.2 });
  }

  private playRoundCompleted() {
    const bus = this.bus(0.8);
    if (!bus) return;
    const run = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    run.forEach((freq, i) => {
      this.tone(bus, { type: "triangle", freq, decay: 0.42, peak: 0.15, at: i * 0.07 });
    });
    this.bell(bus, { carrier: 1046.5, at: 0.44, decay: 1.6, peak: 0.16 });
  }

  /** Woodblock tick; urgency raises pitch, final adds a heartbeat thump. */
  private playTick(urgency: "normal" | "fast" | "final") {
    const bus = this.bus(urgency === "final" ? 0.95 : 0.55);
    if (!bus) return;
    const freq = urgency === "final" ? 1240 : urgency === "fast" ? 950 : 760;
    this.tone(bus, { type: "sine", freq, decay: 0.07, peak: 0.5 });
    this.noise(bus, { duration: 0.018, peak: 0.22, filterType: "bandpass", frequency: 3000, q: 7 });
    if (urgency === "final") {
      this.tone(bus, { type: "sine", freq: 82, freqEnd: 60, decay: 0.18, peak: 0.5 });
    }
  }

  /** Timer expired — a soft closing buzzer, not an alarm clock. */
  private playExpired() {
    const bus = this.bus(0.8);
    if (!bus) return;
    this.tone(bus, { type: "square", freq: 233, freqEnd: 196, decay: 0.5, peak: 0.12, attack: 0.01 });
    this.tone(bus, { type: "sine", freq: 116, freqEnd: 92, decay: 0.5, peak: 0.3 });
    this.noise(bus, { duration: 0.3, peak: 0.1, filterType: "lowpass", frequency: 700, at: 0.05 });
  }

  /* ───────────────────────── event handling ──────────────────────── */

  private onEvent(event: AuctionSoundEvent) {
    if (this._muted) return;

    // Dedupe events that fire twice within 50ms (socket + snapshot paths
    // can deliver the same domain moment twice).
    const last = this.recent.get(event.meta.id);
    if (last && Date.now() - last < 50) return;
    this.recent.set(event.meta.id, Date.now());
    if (this.recent.size > 200) {
      const first = this.recent.keys().next().value;
      if (first) this.recent.delete(first);
    }

    // Audio is a garnish on the auction, never a reason to break it: a
    // failure in any voice (device policy, context quirks) degrades to
    // silence for that event instead of throwing into the event bus.
    try {
      switch (event.type) {
        case "BID_PLACED":
          this.playBid(event.payload.isFirstBid);
          break;
        case "LOT_OPENED":
          this.playLotOpened();
          break;
        case "LOT_SOLD":
          this.playSold();
          break;
        case "LOT_UNSOLD":
          this.playUnsold();
          break;
        case "AUCTION_STARTED":
          this.playAuctionStarted();
          break;
        case "AUCTION_PAUSED":
          this.playPaused();
          break;
        case "AUCTION_RESUMED":
          this.playResumed();
          break;
        case "ROUND_COMPLETED":
          this.playRoundCompleted();
          break;
        case "TIMER_TICK":
          this.playTick(event.payload.urgency);
          break;
      }
    } catch (err) {
      console.warn("[AuctionAudioManager] voice failed:", err);
    }
  }

  /**
   * Fed from the live store's timer.remaining. Ticks the final five
   * seconds and plays a closing buzzer when the clock runs out.
   */
  onTimerUpdate(remaining: number) {
    // Runs inside a store subscription — must never throw back into it.
    try {
      const sec = Math.ceil(remaining);
      if (sec <= 0) {
        if (this.timerHadRun && this.timerLastSecond !== 0) {
          this.timerLastSecond = 0;
          this.timerHadRun = false;
          this.playExpired();
        }
        this.timerLastSecond = -1;
        return;
      }
      if (sec <= 5) this.timerHadRun = true;
      if (sec > 5) {
        this.timerLastSecond = -1;
        return;
      }
      if (sec === this.timerLastSecond) return;
      this.timerLastSecond = sec;

      const urgency: "normal" | "fast" | "final" =
        sec === 1 ? "final" : sec <= 3 ? "fast" : "normal";
      this.playTick(urgency);
    } catch (err) {
      console.warn("[AuctionAudioManager] timer sound failed:", err);
    }
  }

  /* ─────────────────────────── controls ──────────────────────────── */

  setMuted(v: boolean) {
    this._muted = v;
    try {
      localStorage.setItem(MUTE_KEY, JSON.stringify(v));
    } catch {
      /* private mode — preference just won't persist */
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(v ? 0 : this.master, this.ctx.currentTime, 0.03);
    }
  }
  get muted() {
    return this._muted;
  }

  setMaster(v: number) {
    this.master = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx && !this._muted) {
      this.masterGain.gain.setTargetAtTime(this.master, this.ctx.currentTime, 0.03);
    }
  }

  destroy() {
    this.unsub?.();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.reverb = null;
    this.reverbGain = null;
  }
}
