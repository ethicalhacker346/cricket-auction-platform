import { motion } from "framer-motion";
import { useAuctionTimer } from "@/features/auction/hooks/index.hook";
import { cn } from "@/utils/cn";

export function AuctionClock({
  size = 132,
  auctionId,
  tournamentId,
}: {
  size?: number;
  auctionId?: string;
  tournamentId?: string;
}) {
  /* ── FIX: pass options object, not positional args ── */
  const timer = useAuctionTimer(
    auctionId || tournamentId ? { auctionId, tournamentId } : undefined
  );

  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - timer.progress);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={9}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={timer.isCritical ? "#f43f5e" : "#f59e0b"}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: "linear" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className={cn(
            "font-mono text-3xl font-bold tabular-nums tracking-tight text-white",
            timer.isCritical && "animate-pulse text-rose-400"
          )}
        >
          {timer.formatted}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">
          {timer.isRunning
            ? "on the clock"
            : timer.isExpired
            ? "expired"
            : "waiting"}
        </span>
      </div>
    </div>
  );
}