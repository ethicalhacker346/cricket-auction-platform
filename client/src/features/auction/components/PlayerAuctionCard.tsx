import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe2, Gavel, XCircle, Clock, TrendingUp, Shield } from "lucide-react";
import type { Player } from "@/features/auction/types/index.types";
import { ROLE_ICONS } from "@/features/auction/constants/index.constants";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { cn } from "@/utils/cn";

/* =============================================================================
   IMAGE FALLBACK HOOK
   ============================================================================= */
function useImageFallback(src?: string) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return { showImage: Boolean(src) && !failed, onError: () => setFailed(true) };
}

/* =============================================================================
   CONSTANTS & STYLE MAPS
   ============================================================================= */
const TAG_STYLES: Record<string, string> = {
  marquee: "bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 shadow-amber-400/20",
  star: "bg-gradient-to-r from-indigo-400 to-sky-400 text-slate-950 shadow-indigo-400/20",
  uncapped: "bg-white/10 text-slate-300 border border-white/5",
};

const DEFAULT_TAG_STYLE = "bg-white/10 text-slate-300 border border-white/5";

const STATUS_RIBBON: Record<string, { label: string; className: string; icon: React.ReactNode } | null> = {
  sold: {
    label: "SOLD",
    className: "from-emerald-400 to-emerald-600 text-slate-950",
    icon: <Gavel className="h-3.5 w-3.5" />,
  },
  unsold: {
    label: "UNSOLD",
    className: "from-rose-500 to-rose-700 text-white",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  current: null,
  pending: null,
};

/* =============================================================================
   STAT SLOTS — Role-aware curation
   ============================================================================= */
function statSlots(player: Player) {
  const s = player.stats ?? { matches: 0, runs: 0, wickets: 0, average: 0, strikeRate: 0 };
  const base = { label: "Matches", value: s.matches };
  
  switch (player.role) {
    case "Bowler":
      return [
        base,
        { label: "Wickets", value: s.wickets },
        { label: "Average", value: s.average },
        { label: "Economy", value: s.strikeRate }, // SR for bowlers = economy proxy
      ];
    case "All-Rounder":
      return [
        base,
        { label: "Runs", value: s.runs },
        { label: "Wickets", value: s.wickets },
        { label: "Strike Rate", value: s.strikeRate },
      ];
    case "Wicket-Keeper":
      return [
        base,
        { label: "Runs", value: s.runs },
        { label: "Catches", value: s.wickets }, // wickets as catches/stumpings proxy
        { label: "Average", value: s.average },
      ];
    default: // Batter
      return [
        base,
        { label: "Runs", value: s.runs },
        { label: "Average", value: s.average },
        { label: "Strike Rate", value: s.strikeRate },
      ];
  }
}

/* =============================================================================
   STYLE CHIPS — Batting / Bowling / Age
   ============================================================================= */
function StyleChips({ player }: { player: Player }) {
  const chips: { label: string; icon?: string }[] = [];
  
  if (player.battingStyle) chips.push({ label: player.battingStyle, icon: "🏏" });
  if (player.bowlingStyle) chips.push({ label: player.bowlingStyle, icon: "🎯" });
  if (player.age && player.age > 0) chips.push({ label: `${player.age} yrs` });
  
  if (chips.length === 0) return null;
  
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold",
            chip.icon
              ? "bg-white/[0.06] text-slate-300 border border-white/[0.08]"
              : "bg-white/[0.04] text-slate-400 border border-white/[0.05]"
          )}
        >
          {chip.icon && <span className="text-[11px]">{chip.icon}</span>}
          {chip.label}
        </span>
      ))}
    </div>
  );
}

/* =============================================================================
   BIO SNIPPET — Truncated with fade
   ============================================================================= */
function BioSnippet({ bio, maxLength = 120 }: { bio?: string; maxLength?: number }) {
  if (!bio) return null;
  const truncated = bio.length > maxLength ? bio.slice(0, maxLength).trimEnd() + "…" : bio;
  
  return (
    <p className="mt-3 text-[11px] leading-relaxed text-slate-500 italic line-clamp-2">
      "{truncated}"
    </p>
  );
}

/* =============================================================================
   DETERMINISTIC HUE from avatarSeed
   ============================================================================= */
function seedHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

/* =============================================================================
   SOLD BADGE — Team + Price + Timestamp
   ============================================================================= */
function SoldBadge({ player }: { player: Player }) {
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 px-4 py-3.5">
      <div>
        <p className="text-[9px] uppercase tracking-[0.15em] text-emerald-400/70 font-bold">Sold Price</p>
        <p className="mt-1 text-xl font-black text-emerald-400 tracking-tight">
          {formatLakhs(player.soldPrice ?? 0)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[9px] uppercase tracking-[0.15em] text-emerald-400/70 font-bold">To</p>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-gradient-to-br from-amber-400 to-rose-500" />
          <p className="text-sm font-bold text-slate-200">
            {player.soldToTeamName || "Team"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   PRICE BAR — Base Price / Current Bid / Timer
   ============================================================================= */
function PriceBar({ player, nextBidAmount }: { player: Player; nextBidAmount?: number }) {
  const isSold = player.status === "sold";
  const isLive = player.status === "current";
  
  return (
    <div className={cn(
      "mt-4 flex items-center justify-between rounded-xl px-4 py-3.5 border",
      isSold
        ? "bg-black/25 border-emerald-500/15"
        : "bg-black/25 border-white/[0.06]"
    )}>
      <div>
        <p className="text-[9px] uppercase tracking-[0.15em] text-slate-500 font-bold">
          {isSold ? "Sold Price" : "Base Price"}
        </p>
        <p className={cn(
          "mt-1 text-lg font-bold tracking-tight",
          isSold ? "text-emerald-400" : "text-slate-200"
        )}>
          {formatLakhs(isSold && player.soldPrice != null ? player.soldPrice : player.basePrice)}
        </p>
      </div>
      
      <div className="h-8 w-px bg-white/10" />
      
      {isLive && nextBidAmount ? (
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-[0.15em] text-amber-400/70 font-bold flex items-center justify-end gap-1">
            <TrendingUp className="h-3 w-3" /> Next Bid
          </p>
          <p className="mt-1 text-lg font-bold text-amber-400 tracking-tight">
            {formatLakhs(nextBidAmount)}
          </p>
        </div>
      ) : (
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-[0.15em] text-slate-500 font-bold">Age</p>
          <p className="mt-1 text-lg font-bold text-slate-200">{player.age} yrs</p>
        </div>
      )}
    </div>
  );
}

/* =============================================================================
   MAIN COMPONENT: PlayerAuctionCard
   ============================================================================= */
export function PlayerAuctionCard({
  player,
  compact = false,
  nextBidAmount,
}: {
  player: Player | null;
  compact?: boolean;
  nextBidAmount?: number;
}) {
  /* ── Empty state ──
     Deliberately NOT `h-full`: this card sits in a CSS grid column that
     uses the default `stretch` alignment, so `h-full` here used to make
     the card blow up to match whichever sibling column (bid feed / sidebar)
     happened to be tallest — sometimes 2-3x taller than a real, populated
     card. Height is intentionally self-contained instead, sized to roughly
     match a populated card at each breakpoint so nothing visibly jumps when
     a lot goes from "no player" to "player under the hammer" or back. */
  if (!player) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-center",
          compact ? "min-h-[120px]" : "min-h-[320px] sm:min-h-[380px] lg:min-h-[440px]"
        )}
      >
        <div className="rounded-full bg-white/[0.03] p-3 ring-1 ring-white/5">
          <Shield className="h-7 w-7 text-slate-600" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-400">No player under the hammer</p>
          {!compact && (
            <p className="text-xs text-slate-600">The next lot will appear here the moment it goes live.</p>
          )}
        </div>
      </div>
    );
  }

  /* ── Derived state ── */
  const hue = seedHue(player.avatarSeed || player.id || player.name);
  const { showImage, onError } = useImageFallback(player.profileImage);
  const isLive = player.status === "current";
  const isSold = player.status === "sold";
  const isUnsold = player.status === "unsold";
  const ribbon = STATUS_RIBBON[player.status];
  const tagStyle = player.tag ? (TAG_STYLES[player.tag] ?? DEFAULT_TAG_STYLE) : null;
  const roleIcon = ROLE_ICONS[player.role] ?? "🏏";

  /* ── Avatar gradient ── */
  const avatarGradient = `linear-gradient(135deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 55% 16%))`;

  return (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br from-white/[0.07] to-white/[0.01] p-5 transition-colors",
        isLive && "border-amber-400/50 shadow-[0_0_40px_rgba(251,191,36,0.08)]",
        !isLive && "border-white/10",
        isUnsold && "grayscale-[0.35]"
      )}
    >
      {/* ── Live animated ring ── */}
      {isLive && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-amber-400/60"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* ── Ambient glow orb ── */}
      <div
        className="absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
        style={{ background: `hsl(${hue} 80% 55% / 0.12)` }}
      />

      {/* ── Status ribbon (sold/unsold) ── */}
      {ribbon && (
        <div
          className={cn(
            "absolute -right-11 top-5 z-10 w-40 rotate-45 bg-gradient-to-r py-1.5 text-center text-[10px] font-black uppercase tracking-[0.2em] shadow-lg",
            ribbon.className
          )}
        >
          {ribbon.label}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER: Identity Block
         ═══════════════════════════════════════════════════════════════════════ */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          {/* Avatar */}
          <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl ring-2 ring-white/10 shadow-lg">
            {showImage ? (
              <img
                src={player.profileImage}
                alt={player.name}
                onError={onError}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-[22px] font-extrabold text-white"
                style={{ background: avatarGradient }}
              >
                {initials(player.name)}
              </div>
            )}
            {/* Status dot */}
            <div className={cn(
              "absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full border-[3px] border-[#0a0a0f]",
              isLive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
              isSold ? "bg-emerald-400" :
              isUnsold ? "bg-rose-500" :
              "bg-slate-500"
            )} />
          </div>

          {/* Name + Role + Meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-xl font-extrabold leading-tight tracking-tight text-white">
                {player.name}
              </h3>
              {player.tag && (
                <span className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-lg",
                  tagStyle
                )}>
                  {player.tag}
                </span>
              )}
            </div>

            {/* Role + Country */}
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <span className="text-sm">{roleIcon}</span>
              <span>{player.role}</span>
              {player.overseas && (
                <span className="ml-1 inline-flex items-center gap-0.5 text-sky-400">
                  <Globe2 className="h-3 w-3" />
                  {player.country}
                </span>
              )}
            </p>

            {/* Style Chips: Batting / Bowling / Age */}
            <StyleChips player={player} />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BIO SNIPPET
         ═══════════════════════════════════════════════════════════════════════ */}
      {!compact && <BioSnippet bio={player.bio} />}

      {/* ═══════════════════════════════════════════════════════════════════════
          STATS GRID
         ═══════════════════════════════════════════════════════════════════════ */}
      {!compact && (
        <div className="relative mt-4 grid grid-cols-4 gap-2">
          {statSlots(player).map((stat) => (
            <Stat key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          PRICE / BID BAR
         ═══════════════════════════════════════════════════════════════════════ */}
      {!compact && <PriceBar player={player} nextBidAmount={nextBidAmount} />}

      {/* ═══════════════════════════════════════════════════════════════════════
          SOLD: Team badge + timestamp
         ═══════════════════════════════════════════════════════════════════════ */}
      {isSold && !compact && <SoldBadge player={player} />}

      {/* ═══════════════════════════════════════════════════════════════════════
          STATUS FOOTER
         ═══════════════════════════════════════════════════════════════════════ */}
      {(isSold || isUnsold) && (
        <div className="relative mt-3 flex items-center justify-center gap-2 py-1 text-[11px] font-medium text-slate-500">
          {ribbon?.icon}
          <span className={cn(
            isSold ? "text-emerald-400" : "text-rose-400",
            "font-semibold"
          )}>
            {isSold ? "Hammer down" : "Goes back to the pool"}
          </span>
          {player.soldAt && (
            <span className="text-slate-600">
              — {new Date(player.soldAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* =============================================================================
   STAT PILL
   ============================================================================= */
function Stat({ label, value }: { label: string; value: number }) {
  const displayValue = typeof value === "number" ? value.toLocaleString("en-IN") : value;
  
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] py-2.5 px-1 text-center transition-colors hover:bg-white/[0.05]">
      <p className="text-sm font-extrabold text-white tabular-nums">{displayValue}</p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-slate-500 font-bold">{label}</p>
    </div>
  );
}