import { auctionEventBus } from "./EventBus";
import type { AuctionSoundEvent } from "./types";

interface SoundConfig {
  src: string;
  volume?: number;
}

interface Options {
  sounds: Record<string, SoundConfig>;
  masterVolume?: number;
  muted?: boolean;
}

export class AuctionAudioManager {
  private sounds = new Map<string, HTMLAudioElement>();
  private loaded = new Set<string>();
  private ctx: AudioContext | null = null;
  private master: number;
  private _muted: boolean;
  private unlocked = false;
  private recent = new Map<string, number>();
  private unsub: (() => void) | null = null;
  private timerLastSecond = -1;

  constructor(options: Options) {
    this.master = options.masterVolume ?? 1;
    this._muted = options.muted ?? false;

    Object.entries(options.sounds).forEach(([key, cfg]) => {
      const a = new Audio(cfg.src);
      a.preload = "auto";
      a.volume = (cfg.volume ?? 1) * this.master;
      a.addEventListener("canplaythrough", () => this.loaded.add(key), { once: true });
      a.load(); // warm the browser cache
      this.sounds.set(key, a);
    });

    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);

    this.unsub = auctionEventBus.on("*", (e) => this.onEvent(e));
  }

  private onEvent(event: AuctionSoundEvent) {
    if (this._muted) return;

    const last = this.recent.get(event.meta.id);
    if (last && Date.now() - last < 50) return;
    this.recent.set(event.meta.id, Date.now());

    if (this.recent.size > 200) {
      const first = this.recent.keys().next().value;
      if (first) this.recent.delete(first);
    }

    switch (event.type) {
      case "BID_PLACED":
        this.play("hammer", 0.8);
        if (!event.payload.isFirstBid) this.play("crowd", 0.25, 120);
        break;
      case "LOT_OPENED":
        this.play("bell", 0.7);
        break;
      case "LOT_SOLD":
        this.play("gavel", 1.0);
        this.play("applause", 0.45, 350);
        break;
      case "LOT_UNSOLD":
        this.play("lowTone", 0.8);
        break;
      case "AUCTION_STARTED":
        this.play("openingTheme", 0.6);
        break;
      case "AUCTION_PAUSED":
        this.play("softBell", 0.5);
        break;
      case "AUCTION_RESUMED":
        this.play("resumeBell", 0.6);
        break;
      case "ROUND_COMPLETED":
        this.play("success", 0.7);
        break;
      case "TIMER_TICK":
        this.playTick(event.payload.urgency);
        break;
    }
  }

  private play(key: string, vol: number, delayMs = 0) {
    const el = this.sounds.get(key);
    if (!el) return;
    const v = vol * this.master;
    if (v <= 0) return;

    const exec = () => {
      const player = new Audio(el!.src);
      player.volume = v;
      player.play().catch(() => {});
    };

    delayMs ? setTimeout(exec, delayMs) : exec();
  }

  private playTick(urgency: "normal" | "fast" | "final") {
    if (!this.ctx || this.ctx.state !== "running") {
      const map = { normal: "tick", fast: "tickFast", final: "tickFinal" };
      this.play(map[urgency], urgency === "final" ? 0.9 : 0.5);
      return;
    }

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const [freq, dur, peak] =
      urgency === "final" ? [1200, 0.15, 0.8] :
      urgency === "fast"  ? [800,  0.10, 0.5] :
                            [600,  0.08, 0.35];

    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur);
  }

  onTimerUpdate(remaining: number) {
    const sec = Math.ceil(remaining);
    if (sec <= 0 || sec > 5) {
      this.timerLastSecond = -1;
      return;
    }
    if (sec === this.timerLastSecond) return;
    this.timerLastSecond = sec;

    const urgency: AuctionSoundEvent["payload"]["urgency"] =
      sec === 1 ? "final" : sec <= 3 ? "fast" : "normal";

    auctionEventBus.emit({
      type: "TIMER_TICK",
      meta: { id: `tick_${sec}_${Date.now()}`, timestamp: Date.now(), auctionId: "" },
      payload: { remaining: sec, urgency },
    });
  }

  setMuted(v: boolean) {
    this._muted = v;
    localStorage.setItem("auction_audio_muted", JSON.stringify(v));
  }
  get muted() {
    return this._muted;
  }

  setMaster(v: number) {
    this.master = Math.max(0, Math.min(1, v));
  }

  destroy() {
    this.unsub?.();
    this.sounds.forEach((s) => {
      s.pause();
      s.src = "";
    });
    this.sounds.clear();
    this.ctx?.close();
  }
}