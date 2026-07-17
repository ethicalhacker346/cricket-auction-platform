import { cn } from "@/utils/cn";
import { STATUS_COLORS } from "@/features/auction/constants/index.constants";
import type { AuctionStatus, RoundStatus, RoundType } from "@/features/auction/types/index.types";

export function AuctionStatusBadge({ status, className }: { status: AuctionStatus; className?: string }) {
  const isLive = status === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ring-1",
        STATUS_COLORS[status],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", isLive && "animate-pulse")} />
      {status}
    </span>
  );
}

export function RoundStatusBadge({ status }: { status: RoundStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1", STATUS_COLORS[status])}>
      {status}
    </span>
  );
}

const ROUND_TYPE_LABEL: Record<RoundType, string> = {
  marquee: "Marquee",
  capped: "Capped",
  uncapped: "Uncapped",
  overseas: "Overseas",
  accelerated: "Accelerated",
};

// `type` is widened to `string` because AuctionRound.js stores it as free
// text (default: "normal", no enum) — RoundType only documents the values
// this badge has copy/styling for, not every value the backend can send.
export function RoundTypeBadge({ type }: { type: RoundType | (string & {}) }) {
  const label = ROUND_TYPE_LABEL[type as RoundType] ?? (type ? `${type[0].toUpperCase()}${type.slice(1)}` : "Round");
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300 ring-1 ring-indigo-500/30">
      {label}
    </span>
  );
}

export function CurrentRoundBadge({ name, type }: { name: string; type: RoundType | (string & {}) }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 ring-1 ring-white/10">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Round</span>
      <span className="text-sm font-semibold text-white">{name}</span>
      <RoundTypeBadge type={type} />
    </div>
  );
}

export function ConnectionDot({ connection }: { connection: "connecting" | "connected" | "reconnecting" | "offline" }) {
  const map: Record<string, string> = {
    connected: "bg-emerald-400",
    connecting: "bg-amber-400 animate-pulse",
    reconnecting: "bg-amber-400 animate-pulse",
    offline: "bg-rose-500",
  };
  return <span className={cn("h-2 w-2 rounded-full", map[connection] ?? "bg-slate-500")} />;
}