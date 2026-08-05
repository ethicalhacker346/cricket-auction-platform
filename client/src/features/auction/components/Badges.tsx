import { cn } from "@/utils/cn";
import { STATUS_COLORS } from "@/features/auction/constants/index.constants";
import type {
  AuctionStatus,
  RoundStatus,
  AuctionRoundType,
  AuctionRoundCategory,
} from "@/features/auction/types/index.types";

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

/* ============================================================================
   ROUND TYPE
   ----------------------------------------------------------------------------
   Backend enum (AuctionRound.js / ROUND_TYPE): "normal" | "unsold".
   This is a STRUCTURAL/engine concept — it governs auction flow (the unsold
   round is auto-created, engine-managed, always ordered last, and its
   playerIds cannot be edited manually — see AuctionRound.js
   enforceUnsoldRoundPlayerIds). It has nothing to do with which players a
   round contains.

   Do NOT confuse this with AuctionRoundCategory below. Older revisions of
   this file conflated the two ("marquee" / "capped" / "overseas" / etc. were
   incorrectly treated as round "type"); that concept is actually
   AuctionRoundCategory.
   ============================================================================ */
const ROUND_TYPE_META: Record<AuctionRoundType, { label: string; classes: string }> = {
  normal: {
    label: "Normal",
    classes: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30",
  },
  unsold: {
    label: "Unsold Pool",
    classes: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  },
};

// `type` is widened to `string` because older/unmigrated data could in theory
// still contain an out-of-enum value — this is a display-only fallback, not
// a supported value. AuctionRound.js enforces the real enum server-side.
export function RoundTypeBadge({ type }: { type: AuctionRoundType | (string & {}) }) {
  const meta = ROUND_TYPE_META[type as AuctionRoundType];
  const label = meta?.label ?? (type ? `${type[0].toUpperCase()}${type.slice(1)}` : "Round");
  const classes = meta?.classes ?? "bg-slate-500/10 text-slate-300 ring-slate-500/30";

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1", classes)}>
      {label}
    </span>
  );
}

/* ============================================================================
   ROUND CATEGORY
   ----------------------------------------------------------------------------
   Backend field (AuctionRound.js `category`, free-text string) describing
   WHICH PLAYERS a round is meant for. This is organizer-authored content,
   not an engine-enforced enum — AuctionRoundCategory in index.types.ts
   documents the values the UI has copy/styling for, not every value the
   backend can accept (hence the `| string` widening on the prop, matching
   RoundTypeBadge's pattern above).
   ============================================================================ */
const ROUND_CATEGORY_META: Record<AuctionRoundCategory, { label: string; icon: string; classes: string }> = {
  BATSMAN: { label: "Batters", icon: "🏏", classes: "bg-sky-500/10 text-sky-300 ring-sky-500/30" },
  BOWLER: { label: "Bowlers", icon: "🎾", classes: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" },
  ALL_ROUNDER: { label: "All-Rounders", icon: "⭐", classes: "bg-violet-500/10 text-violet-300 ring-violet-500/30" },
  WICKET_KEEPER: { label: "Keepers", icon: "🧤", classes: "bg-orange-500/10 text-orange-300 ring-orange-500/30" },
  CAPPED: { label: "Capped", icon: "🎖️", classes: "bg-blue-500/10 text-blue-300 ring-blue-500/30" },
  UNCAPPED: { label: "Uncapped", icon: "🌱", classes: "bg-slate-500/10 text-slate-300 ring-slate-500/30" },
  OVERSEAS: { label: "Overseas", icon: "✈️", classes: "bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-500/30" },
  MARQUEE: { label: "Marquee", icon: "👑", classes: "bg-yellow-500/10 text-yellow-300 ring-yellow-500/30" },
  CUSTOM: { label: "Custom", icon: "🏷️", classes: "bg-slate-500/10 text-slate-400 ring-slate-500/30" },
};

export function RoundCategoryBadge({ category }: { category: AuctionRoundCategory | string }) {
  const meta = ROUND_CATEGORY_META[category as AuctionRoundCategory];
  const label = meta?.label ?? (category ? `${category[0].toUpperCase()}${category.slice(1).toLowerCase()}` : "Custom");
  const icon = meta?.icon ?? "🏷️";
  const classes = meta?.classes ?? ROUND_CATEGORY_META.CUSTOM.classes;

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1", classes)}>
      <span aria-hidden className="text-[11px] normal-case">{icon}</span>
      {label}
    </span>
  );
}

export function CurrentRoundBadge({
  name,
  type,
  category,
}: {
  name: string;
  type: AuctionRoundType | (string & {});
  category?: AuctionRoundCategory | string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 ring-1 ring-white/10">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Round</span>
      <span className="text-sm font-semibold text-white">{name}</span>
      <RoundTypeBadge type={type} />
      {category ? <RoundCategoryBadge category={category} /> : null}
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