import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { Trophy, ArrowRight, Ban, Volume2, VolumeX, X } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════
   SoldUnsoldAnimation — the auction's moment of truth.

   A full-screen cinematic reveal: the gavel falls in three deliberate
   strikes, a shockwave ring fires, film-grain + confetti for a SOLD
   verdict, or a rain of falling tags for UNSOLD. All sound is fully
   synthesized WebAudio (mastered, reverberant); the TTS announcer is an
   opt-in layer underneath the score rather than instead of it.
   ═══════════════════════════════════════════════════════════════════════ */

const MUTE_KEY = "auction_audio_muted";
const TICKER = "SOLD • SOLD • SOLD • SOLD • SOLD • SOLD • SOLD • SOLD • ";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_IN = [0.55, 0, 1, 0.45] as const;

/* ─────────────────────────── types ─────────────────────────── */

export interface SoldUnsoldAnimationProps {
  playerName: string;
  playerRole?: string;
  teamName?: string;
  teamLogoUrl?: string;
  teamColor?: string;
  soldAmount?: number;
  isSold: boolean;
  onClose?: () => void;
  /** ms before auto-dismiss. Defaults: 4200 sold / 3000 unsold. */
  autoDismissMs?: number;
  /** Show the synthesized sound + TTS announcer. Default true. */
  enableSound?: boolean;
}

/* ──────────────────────── confetti pieces ──────────────────────── */

interface ConfettiPiece {
  left: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  sway: number;
  spin: number;
  circle: boolean;
}

function useConfetti(active: boolean): ConfettiPiece[] {
  return useMemo(() => {
    if (!active) return [];
    const palette = ["#fbbf24", "#fde047", "#34d399", "#f472b6", "#f8fafc"];
    return Array.from({ length: 48 }, (_, i) => ({
      left: Math.random() * 100,
      size: 5 + Math.random() * 7,
      color: palette[i % palette.length],
      delay: 0.9 + Math.random() * 0.6,
      duration: 1.9 + Math.random() * 1.3,
      sway: (Math.random() - 0.5) * 60,
      spin: 180 + Math.random() * 540,
      circle: Math.random() > 0.6,
    }));
  }, [active]);
}

interface FallTag {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
}

function useFallTags(active: boolean): FallTag[] {
  return useMemo(() => {
    if (!active) return [];
    return Array.from({ length: 14 }, () => ({
      left: 3 + Math.random() * 94,
      delay: 0.55 + Math.random() * 1.1,
      duration: 1.5 + Math.random() * 0.9,
      drift: (Math.random() - 0.5) * 80,
      spin: 90 + Math.random() * 270,
    }));
  }, [active]);
}

/* ══════════════════════════ component ══════════════════════════ */

export const SoldUnsoldAnimation: React.FC<SoldUnsoldAnimationProps> = ({
  playerName,
  playerRole,
  teamName,
  teamLogoUrl,
  teamColor,
  soldAmount,
  isSold,
  onClose,
  autoDismissMs,
  enableSound = true,
}) => {
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem(MUTE_KEY) ?? "false");
    } catch {
      return false;
    }
  });

  const confetti = useConfetti(isSold);
  const tags = useFallTags(!isSold);
  const cardControls = useAnimationControls();

  const accent = teamColor ?? (isSold ? "#34d399" : "#94a3b8");
  const dismissAfter = autoDismissMs ?? (isSold ? 4200 : 3000);

  /* ── sound (fully synthesized, mastered) ── */
  useEffect(() => {
    if (!enableSound || muted) return;
    playVerdictScore(isSold, playerName, teamName, soldAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSold, muted, enableSound]);

  /* ── auto dismiss ── */
  useEffect(() => {
    const t = window.setTimeout(() => onClose?.(), dismissAfter);
    return () => window.clearTimeout(t);
  }, [dismissAfter, onClose]);

  /* ── escape to dismiss ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem(MUTE_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  };

  const verdictWord = isSold ? "SOLD!" : "UNSOLD";
  const letters = verdictWord.split("");

  return (
    <AnimatePresence>
      <motion.div
        key="verdict-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        role="dialog"
        aria-modal="true"
        aria-label={isSold ? `${playerName} sold` : `${playerName} unsold`}
        onClick={onClose}
      >
        {/* backdrop */}
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

        {/* film grain */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* spotlight */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 70% 55% at 50% 46%, ${accent}26 0%, transparent 65%)`,
          }}
        />

        {/* shockwave rings (sold only) */}
        {isSold && (
          <>
            {[0, 0.22].map((delay, i) => (
              <motion.div
                key={i}
                aria-hidden
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 160,
                  height: 160,
                  border: `2px solid ${accent}`,
                  boxShadow: `0 0 40px ${accent}55`,
                }}
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: [0.2, 3.4], opacity: [0, 0.75, 0] }}
                transition={{ delay: 1.62 + delay, duration: 0.9, ease: "easeOut" }}
              />
            ))}
          </>
        )}

        {/* ticker strip (sold only) */}
        {isSold && (
          <div
            aria-hidden
            className="absolute top-8 left-0 right-0 overflow-hidden opacity-20 pointer-events-none select-none"
          >
            <motion.div
              className="whitespace-nowrap font-black text-3xl tracking-[0.4em] text-emerald-300"
              initial={{ x: 0 }}
              animate={{ x: "-50%" }}
              transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
            >
              {TICKER + TICKER}
            </motion.div>
          </div>
        )}

        {/* confetti (sold) */}
        {isSold &&
          confetti.map((c, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute top-0 pointer-events-none"
              style={{
                left: `${c.left}%`,
                width: c.size,
                height: c.circle ? c.size : c.size * 1.8,
                backgroundColor: c.color,
                borderRadius: c.circle ? "50%" : 2,
              }}
              initial={{ y: -30, x: 0, rotate: 0, opacity: 0 }}
              animate={{
                y: ["0vh", "105vh"],
                x: [0, c.sway, -c.sway * 0.6],
                rotate: c.spin,
                opacity: [0, 1, 1, 0.8],
              }}
              transition={{
                delay: c.delay,
                duration: c.duration,
                ease: "easeIn",
              }}
            />
          ))}

        {/* falling price tags (unsold) */}
        {!isSold &&
          tags.map((t, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute top-0 pointer-events-none select-none"
              style={{ left: `${t.left}%`, fontSize: 22 }}
              initial={{ y: -40, x: 0, rotate: 0, opacity: 0 }}
              animate={{ y: ["0vh", "108vh"], x: [0, t.drift], rotate: t.spin, opacity: [0, 0.85, 0.85, 0] }}
              transition={{ delay: t.delay, duration: t.duration, ease: "easeIn" }}
            >
              🏷️
            </motion.span>
          ))}

        {/* control buttons */}
        <div className="absolute top-5 right-5 flex items-center gap-2 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            className="rounded-full bg-white/10 hover:bg-white/20 border border-white/15 p-2.5 text-white/80 transition-colors"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            aria-label="Dismiss"
            className="rounded-full bg-white/10 hover:bg-white/20 border border-white/15 p-2.5 text-white/80 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ══════════ the verdict card ══════════ */}
        <motion.div
          className="relative w-[min(92vw,480px)]"
          animate={cardControls}
          initial={{ scale: 0.8, opacity: 0, y: 34 }}
          whileInView={undefined}
          transition={{ duration: 0.55, ease: EASE_OUT }}
          ref={(el) => {
            if (!el) return;
            // Entrance → gavel slam kicks (sold) or settle (unsold)
            cardControls.start({
              scale: [0.8, 1.04, 1],
              opacity: 1,
              y: 0,
              transition: { duration: 0.55, ease: EASE_OUT },
            });
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="relative overflow-hidden rounded-3xl border px-8 pb-8 pt-10 text-center"
            style={{
              background: isSold
                ? "linear-gradient(160deg, rgba(6,30,20,0.96), rgba(2,12,9,0.98))"
                : "linear-gradient(160deg, rgba(24,26,34,0.96), rgba(8,9,13,0.98))",
              borderColor: `${accent}44`,
              boxShadow: `0 30px 90px -20px ${accent}55, 0 0 0 1px ${accent}22 inset`,
            }}
          >
            {/* verdict ribbon */}
            <motion.div
              className="absolute -left-14 top-7 rotate-[-38deg] px-16 py-1.5 text-xs font-black tracking-[0.3em]"
              style={{
                background: isSold
                  ? "linear-gradient(90deg,#059669,#34d399)"
                  : "linear-gradient(90deg,#475569,#94a3b8)",
                color: isSold ? "#052e1c" : "#0f172a",
              }}
              initial={{ x: -60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.45, ease: EASE_OUT }}
            >
              {isSold ? "SOLD" : "PASS"}
            </motion.div>

            {/* verdict icon */}
            <motion.div
              className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background: `${accent}1f`,
                border: `2px solid ${accent}66`,
                boxShadow: `0 0 44px ${accent}44`,
              }}
              initial={{ scale: 0, rotate: isSold ? -120 : 120 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            >
              {isSold ? (
                <Trophy className="h-9 w-9" style={{ color: accent }} />
              ) : (
                <Ban className="h-9 w-9" style={{ color: accent }} />
              )}
            </motion.div>

            {/* player name */}
            <motion.h2
              className="text-3xl font-black text-white leading-tight"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4, ease: EASE_OUT }}
            >
              {playerName}
            </motion.h2>
            {playerRole && (
              <motion.p
                className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.42 }}
              >
                {playerRole}
              </motion.p>
            )}

            {/* verdict word — letter-cascade with landing bounce */}
            <div
              className="mt-4 flex items-end justify-center gap-1 select-none"
              aria-hidden
            >
              {letters.map((ch, i) => (
                <motion.span
                  key={i}
                  className={`inline-block font-black ${
                    ch === " " ? "w-3" : ""
                  } ${isSold ? "text-6xl" : "text-5xl"}`}
                  style={{
                    color: isSold ? "#fbbf24" : "#cbd5e1",
                    textShadow: isSold
                      ? "0 0 30px rgba(251,191,36,0.55), 0 2px 0 rgba(120,70,0,0.6)"
                      : "0 0 24px rgba(148,163,184,0.35)",
                    fontFamily: "'Arial Black', 'Helvetica Neue', sans-serif",
                    WebkitTextStroke: isSold ? "1px rgba(120,70,0,0.45)" : "1px rgba(15,23,42,0.5)",
                  }}
                  initial={{ y: -90, opacity: 0, scaleY: 1.4 }}
                  animate={{ y: [ -90, 8, -4, 0 ], opacity: 1, scaleY: 1 }}
                  transition={{
                    delay: 0.55 + i * 0.06,
                    duration: 0.55,
                    times: [0, 0.7, 0.85, 1],
                    ease: "easeOut",
                  }}
                >
                  {ch === " " ? "\u00A0" : ch}
                </motion.span>
              ))}
            </div>

            {/* destination row */}
            <motion.div
              className="mt-6 flex items-center justify-center gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.05, duration: 0.4, ease: EASE_OUT }}
            >
              {isSold ? (
                <>
                  {teamLogoUrl ? (
                    <img
                      src={teamLogoUrl}
                      alt={teamName ?? ""}
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20"
                    />
                  ) : (
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ring-2 ring-white/20"
                      style={{ background: `${accent}33`, color: accent }}
                    >
                      {(teamName ?? "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="text-lg font-bold text-white/90">{teamName}</span>
                  {soldAmount != null && (
                    <>
                      <ArrowRight className="h-4 w-4 text-white/40" />
                      <AnimatedAmount value={soldAmount} />
                    </>
                  )}
                </>
              ) : (
                <span className="text-base font-medium text-white/60">
                  No bids received — returns to the pool
                </span>
              )}
            </motion.div>

            {/* gavel rap marks (sold) */}
            {isSold && (
              <motion.div
                className="mx-auto mt-7 flex w-fit items-center gap-2 opacity-70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ delay: 1.6 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="block h-1.5 w-8 rounded-full bg-amber-400/70"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 1.62 + i * 0.14, duration: 0.12, ease: "easeOut" }}
                    style={{ transformOrigin: "left" }}
                  />
                ))}
              </motion.div>
            )}

            {/* sweep shine (sold) */}
            {isSold && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                initial={{ x: "-120%" }}
                animate={{ x: "120%" }}
                transition={{ delay: 1.3, duration: 1.1, ease: EASE_IN }}
                style={{
                  background:
                    "linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.09) 50%, transparent 80%)",
                  width: "55%",
                }}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SoldUnsoldAnimation;

/* ───────────────── animated amount ───────────────── */

const AnimatedAmount: React.FC<{ value: number }> = ({ value }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className="text-2xl font-black tabular-nums text-amber-300" style={{ textShadow: "0 0 24px rgba(251,191,36,0.5)" }}>
      {formatINRCompact(display)}
    </span>
  );
};

function formatINRCompact(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2).replace(/\.00$/, "")} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1).replace(/\.0$/, "")} L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `₹${n}`;
}

/* ═════════════════ synthesized verdict score ═════════════════
   Self-contained WebAudio: gavel raps + applause swell + fanfare for SOLD,
   descending sigh + floor thud for UNSOLD, with an optional TTS announcer
   line layered underneath. Generated impulse-response reverb gives it room.
   ═══════════════════════════════════════════════════════════════ */

function playVerdictScore(
  isSold: boolean,
  playerName: string,
  teamName?: string,
  soldAmount?: number,
) {
  const ctx = getSharedCtx();
  if (ctx) {
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    master.connect(comp);

    const reverb = makeReverb(ctx);
    if (reverb) {
      const wet = ctx.createGain();
      wet.gain.value = 0.3;
      reverb.connect(wet).connect(master);
      if (isSold) synthSold(ctx, master, reverb);
      else synthUnsold(ctx, master, reverb);
    }
  }
  speakVerdict(isSold, playerName, teamName, soldAmount);
}

let sharedCtx: AudioContext | null = null;
function getSharedCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  if (sharedCtx.state === "suspended") void sharedCtx.resume().catch(() => {});
  return sharedCtx;
}

function makeReverb(ctx: AudioContext): ConvolverNode | null {
  try {
    const seconds = 1.4;
    const len = Math.floor(seconds * ctx.sampleRate);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    return conv;
  } catch {
    return null;
  }
}

function synthTone(
  ctx: AudioContext, out: AudioNode,
  o: { type: OscillatorType; f: number; fEnd?: number; at: number; decay: number; peak: number },
) {
  const t = ctx.currentTime + o.at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type;
  osc.frequency.setValueAtTime(Math.max(20, o.f), t);
  if (o.fEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.fEnd), t + o.decay * 0.9);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(o.peak, t + 0.006);
  g.exponentialRampToValueAtTime(0.0004, t + o.decay);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + o.decay + 0.05);
}

function synthNoise(
  ctx: AudioContext, out: AudioNode,
  o: { at: number; dur: number; peak: number; type: BiquadFilterType; freq: number; freqEnd?: number; q?: number; attack?: number },
) {
  const t = ctx.currentTime + o.at;
  const len = Math.max(1, Math.floor(ctx.sampleRate * o.dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = o.type;
  f.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.freqEnd), t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  g.setValueAtTime(0, t);
  g.linearRampToValueAt(o.peak, t + (o.attack ?? 0.005));
  g.exponentialRampToValueAtTime(0.0004, t + o.dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + o.dur + 0.05);
}

function synthSold(ctx: AudioContext, dry: AudioNode, wet: AudioNode) {
  // three gavel raps — one-two-three
  [0, 0.16, 0.34].forEach((at, i) => {
    const weight = 1 - i * 0.14;
    synthTone(ctx, dry, { type: "sine", f: 95, fEnd: 50, at, decay: 0.22, peak: 0.85 * weight });
    synthNoise(ctx, dry, { at, dur: 0.1, peak: 0.5 * weight, type: "lowpass", freq: 520, q: 0.8 });
    synthNoise(ctx, dry, { at, dur: 0.028, peak: 0.36 * weight, type: "bandpass", freq: 2200, q: 4 });
    // room echo of the rap
    synthTone(ctx, wet, { type: "sine", f: 140, fEnd: 70, at: at + 0.02, decay: 0.5, peak: 0.3 * weight });
  });
  // applause swell
  synthNoise(ctx, dry, { at: 0.55, dur: 1.4, peak: 0.3, attack: 0.28, type: "bandpass", freq: 1100, freqEnd: 1700, q: 0.6 });
  synthNoise(ctx, dry, { at: 0.6, dur: 1.1, peak: 0.16, attack: 0.24, type: "highpass", freq: 5000 });
  // fanfare: C5 E5 G5 C6
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const at = 0.62 + i * 0.09;
    synthTone(ctx, dry, { type: "triangle", f, at, decay: 0.55, peak: 0.15 });
    synthTone(ctx, wet, { type: "triangle", f: f * 2, at, decay: 0.4, peak: 0.06 });
  });
}

function synthUnsold(ctx: AudioContext, dry: AudioNode, wet: AudioNode) {
  synthTone(ctx, dry, { type: "sawtooth", f: 220, fEnd: 156, at: 0, decay: 0.6, peak: 0.14 });
  synthTone(ctx, dry, { type: "sawtooth", f: 221.5, fEnd: 154, at: 0, decay: 0.6, peak: 0.14 });
  synthTone(ctx, wet, { type: "sine", f: 110, fEnd: 76, at: 0.05, decay: 0.7, peak: 0.3 });
  synthNoise(ctx, dry, { at: 0.4, dur: 0.35, peak: 0.12, type: "lowpass", freq: 320 });
}

function speakVerdict(
  isSold: boolean,
  playerName: string,
  teamName?: string,
  soldAmount?: number,
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const amount = soldAmount != null ? formatINRCompact(soldAmount) : "";
  const text = isSold
    ? `${playerName}, sold${teamName ? ` to ${teamName}` : ""}${amount ? ` for ${amount.replace("₹", "rupees ")}` : ""}!`
    : `${playerName} goes unsold.`;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = isSold ? 1.02 : 0.95;
    utterance.pitch = isSold ? 1.05 : 0.9;
    utterance.volume = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang === "en-IN") ??
      voices.find((v) => v.lang === "en-GB") ??
      voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* TTS is a garnish — never let it break the reveal */
  }
}
