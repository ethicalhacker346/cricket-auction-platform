import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuctionTimer } from "@/features/auction/hooks/index.hook";
import { cn } from "@/utils/cn";

/**
 * AuctionClock — a world-class, precision bid timer.
 *
 *  - Precision: the progress arc is keyed off a monotonic 1-second visual
 *    pulse so the ring depletes in crisp, legible beats, while the digits
 *    themselves come from the server-authoritative live store (never
 *    local drift). Urgency bands escalate colour, glow and motion.
 *  - Craft: dual-layer ring (glow underlay + gradient arc), per-digit
 *    vertical slide transitions, tick marks around the dial, a travelling
 *    "comet" at the arc head, and a critical state with an expanding
 *    heartbeat ring + screen-side red vignette.
 */

interface AuctionClockProps {
  size?: number;
  auctionId?: string;
  tournamentId?: string;
  /** Show the "on the clock / expired / waiting" caption. Default true. */
  showCaption?: boolean;
}

type Band = "calm" | "warn" | "hot" | "critical" | "idle";

const BAND_COLORS: Record<Band, { from: string; to: string; glow: string; text: string }> = {
  calm: { from: "#34d399", to: "#22d3ee", glow: "rgba(52,211,153,0.55)", text: "text-emerald-300" },
  warn: { from: "#fbbf24", to: "#f59e0b", glow: "rgba(251,191,36,0.55)", text: "text-amber-300" },
  hot: { from: "#fb923c", to: "#f43f5e", glow: "rgba(251,113,60,0.6)", text: "text-orange-300" },
  critical: { from: "#f43f5e", to: "#e11d48", glow: "rgba(244,63,94,0.7)", text: "text-rose-400" },
  idle: { from: "#475569", to: "#64748b", glow: "rgba(100,116,139,0.35)", text: "text-slate-300" },
};

function bandFor(remaining: number, isRunning: boolean): Band {
  if (!isRunning) return "idle";
  if (remaining <= 5) return "critical";
  if (remaining <= 10) return "hot";
  if (remaining <= 20) return "warn";
  return "calm";
}

export function AuctionClock({
  size = 132,
  auctionId,
  tournamentId,
  showCaption = true,
}: AuctionClockProps) {
  const timer = useAuctionTimer(
    auctionId || tournamentId ? { auctionId, tournamentId } : undefined
  );

  const band = bandFor(timer.remaining, timer.isRunning);
  const colors = BAND_COLORS[band];

  const stroke = Math.max(7, Math.round(size * 0.068));
  const radius = (size - stroke * 2.4) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, timer.progress));
  const arcLength = circumference * progress;

  // Comet head position at the tip of the arc (12 o'clock = -90°)
  const headAngle = -Math.PI / 2 + progress * Math.PI * 2;
  const headX = center + Math.cos(headAngle) * radius;
  const headY = center + Math.sin(headAngle) * radius;

  const tickMarks = useMemo(() => {
    const count = 60;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const major = i % 5 === 0;
      const rOuter = radius + stroke * 0.9;
      const rInner = rOuter - (major ? stroke * 0.75 : stroke * 0.4);
      return {
        x1: center + Math.cos(angle) * rInner,
        y1: center + Math.sin(angle) * rInner,
        x2: center + Math.cos(angle) * rOuter,
        y2: center + Math.sin(angle) * rOuter,
        major,
        key: i,
      };
    });
  }, [radius, stroke, center]);

  const formatted = timer.formatted;
  const digits = formatted.split("");
  const digitSize = Math.round(size * 0.24);

  const gradientId = useMemo(() => `clock-grad-${Math.random().toString(36).slice(2, 9)}`, []);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-live="polite"
      aria-label={`${formatted} remaining${timer.isRunning ? "" : timer.isExpired ? ", expired" : ", waiting"}`}
    >
      {/* critical heartbeat ring */}
      {band === "critical" && (
        <motion.div
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{
            width: size * 0.86,
            height: size * 0.86,
            border: "2px solid rgba(244,63,94,0.6)",
          }}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: [0.9, 1.18], opacity: [0.7, 0] }}
          transition={{ repeat: Infinity, duration: 1, ease: "easeOut" }}
        />
      )}

      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.from} />
            <stop offset="100%" stopColor={colors.to} />
          </linearGradient>
        </defs>

        {/* dial face */}
        <circle
          cx={center}
          cy={center}
          r={radius - stroke * 0.9}
          fill="rgba(2,6,23,0.55)"
        />

        {/* tick marks */}
        {tickMarks.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="rgba(148,163,184,0.28)"
            strokeWidth={t.major ? 1.6 : 0.8}
            strokeLinecap="round"
          />
        ))}

        {/* track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
          fill="none"
        />

        {/* glow underlay */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.glow}
          strokeWidth={stroke * 1.7}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          style={{ filter: "blur(6px)", opacity: 0.55 }}
          animate={{ strokeDasharray: `${arcLength} ${circumference}` }}
          transition={{ duration: 1, ease: "linear" }}
        />

        {/* main gradient arc */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          animate={{ strokeDasharray: `${arcLength} ${circumference}` }}
          transition={{ duration: 1, ease: "linear" }}
        />

        {/* comet head */}
        {timer.isRunning && progress > 0 && (
          <motion.circle
            cx={headX}
            cy={headY}
            r={stroke * 0.62}
            fill="#fff"
            style={{ filter: `drop-shadow(0 0 6px ${colors.glow}) drop-shadow(0 0 14px ${colors.glow})` }}
            animate={{ cx: headX, cy: headY }}
            transition={{ duration: 1, ease: "linear" }}
          />
        )}
      </svg>

      {/* digits */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className={cn("flex items-baseline justify-center font-mono font-bold tabular-nums tracking-tight", colors.text)}
          style={{
            fontSize: digitSize,
            lineHeight: 1,
            textShadow: band === "critical" ? `0 0 22px ${colors.glow}` : `0 0 14px ${colors.glow}`,
            height: digitSize * 1.15,
            overflow: "hidden",
          }}
        >
          {digits.map((d, i) => (
            <span
              key={i}
              className="relative inline-block overflow-hidden"
              style={{ width: d === ":" ? digitSize * 0.42 : digitSize * 0.64, height: digitSize * 1.15 }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={d}
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ y: "80%", opacity: 0, filter: "blur(3px)" }}
                  animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: "-80%", opacity: 0, filter: "blur(3px)" }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  {d}
                </motion.span>
              </AnimatePresence>
            </span>
          ))}
        </div>

        {showCaption && (
          <span
            className={cn(
              "mt-1 text-[10px] font-semibold uppercase tracking-[0.28em]",
              band === "critical" ? "text-rose-400" : "text-slate-500"
            )}
          >
            {timer.isRunning ? "on the clock" : timer.isExpired ? "time" : "waiting"}
          </span>
        )}
      </div>

      {/* pulse scale when critical */}
      {band === "critical" && <CriticalPulse size={size} />}
    </div>
  );
}

/** Whole-dial heartbeat scale, layered as a sibling so it never re-renders the SVG. */
function CriticalPulse({ size }: { size: number }) {
  const [beat, setBeat] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setBeat((b) => !b), 500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <motion.div
      aria-hidden
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        boxShadow: "inset 0 0 40px rgba(244,63,94,0.18)",
      }}
      animate={{ opacity: beat ? 1 : 0.35 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    />
  );
}

export default AuctionClock;
