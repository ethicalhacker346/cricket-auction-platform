import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Crown, Shield, Wallet2, User, Globe, MapPin } from "lucide-react";
import type { Franchise, Player } from "@/features/auction/types/index.types";
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
   TEAM EMBLEM
   ============================================================================= */
function TeamEmblem({
  franchise,
  size = "md",
}: {
  franchise: Franchise;
  size?: "sm" | "md" | "lg";
}) {
  const { showImage, onError } = useImageFallback(franchise.logo);
  const dims =
    size === "lg"
      ? "h-16 w-16 text-xl"
      : size === "md"
      ? "h-12 w-12 text-sm"
      : "h-7 w-7 text-[9px]";

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl font-bold text-white shadow-xl",
        dims
      )}
    >
      {showImage ? (
        <img
          src={franchise.logo}
          alt={franchise.name}
          onError={onError}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${franchise.colorFrom}, ${franchise.colorTo})`,
          }}
        >
          {initials(franchise.shortName)}
        </span>
      )}
    </span>
  );
}

/* =============================================================================
   PLAYER AVATAR
   ============================================================================= */
function PlayerAvatar({ player }: { player: Player }) {
  const { showImage, onError } = useImageFallback(player.profileImage);
  const hue = useMemo(() => {
    const seed = player.avatarSeed || player.id || player.name;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return h % 360;
  }, [player.avatarSeed, player.id, player.name]);

  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-2 ring-white/10">
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
          className="flex h-full w-full items-center justify-center text-xs font-extrabold text-white"
          style={{
            background: `linear-gradient(135deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 55% 16%))`,
          }}
        >
          {initials(player.name)}
        </div>
      )}
    </div>
  );
}

/* =============================================================================
   TEAM BUDGET CARD
   ============================================================================= */
export function TeamBudgetCard({
  franchise,
  players = [],
}: {
  franchise: Franchise;
  players?: Player[];
}) {
  const reserved = franchise.reservedBudget ?? 0;
  const remaining = franchise.purseTotal - franchise.spent - reserved;
  const pctSpent = franchise.purseTotal > 0 ? (franchise.spent / franchise.purseTotal) * 100 : 0;
  const pctReserved = franchise.purseTotal > 0 ? (reserved / franchise.purseTotal) * 100 : 0;

  // ── FIX: Null-safe squad composition ──
  const squadPlayers = useMemo(
    () => (players ?? []).filter((p) => franchise.squad?.includes(p.id) ?? false),
    [players, franchise.squad]
  );

  const composition = useMemo(
    () => ({
      batters: squadPlayers.filter((p) => p.role === "Batter").length,
      bowlers: squadPlayers.filter((p) => p.role === "Bowler").length,
      allRounders: squadPlayers.filter((p) => p.role === "All-Rounder").length,
      wicketKeepers: squadPlayers.filter((p) => p.role === "Wicket-Keeper").length,
    }),
    [squadPlayers]
  );

  const overseasCount = squadPlayers.filter((p) => p.overseas).length;
  const overseasFull = overseasCount >= franchise.maxOverseas;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.01] p-0">
      {/* Brand glow */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl opacity-20"
        style={{ background: franchise.colorFrom }}
      />

      {/* Header */}
      <div className="relative p-6 pb-0">
        <div className="flex items-start gap-4">
          <TeamEmblem franchise={franchise} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-extrabold text-white">{franchise.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                {franchise.owner}
              </span>
              {franchise.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {franchise.city}
                </span>
              )}
            </div>
            {franchise.description && (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                {franchise.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Purse breakdown */}
      <div className="relative px-6 pt-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-3 text-center">
            <p className="text-base font-black text-white">{formatLakhs(franchise.purseTotal)}</p>
            <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.15em] text-slate-500">
              Total Purse
            </p>
          </div>
          <div className="rounded-xl border border-rose-500/10 bg-rose-500/[0.04] px-3 py-3 text-center">
            <p className="text-base font-black text-rose-400">{formatLakhs(franchise.spent)}</p>
            <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.15em] text-slate-500">
              Spent
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] px-3 py-3 text-center">
            <p className={cn("text-base font-black", remaining < 0 ? "text-rose-500" : "text-emerald-400")}>
              {formatLakhs(remaining)}
            </p>
            <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.15em] text-slate-500">
              Remaining
            </p>
          </div>
        </div>

        {/* Reserved warning */}
        {reserved > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-4 py-2.5">
            <Wallet2 className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-400">
              {formatLakhs(reserved)} reserved on active bid
            </span>
          </div>
        )}

        {/* Segmented budget bar */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">
              Budget Utilization
            </span>
            <span className="text-xs font-extrabold text-white">
              {(((franchise.spent + reserved) / franchise.purseTotal) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
            <motion.div
              className="bg-gradient-to-r from-rose-500 to-rose-400"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, pctSpent)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            <motion.div
              className="bg-gradient-to-r from-amber-400 to-amber-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100 - pctSpent, pctReserved)}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[9px] font-semibold">
            <span className="text-rose-400">{formatLakhs(franchise.spent)} spent</span>
            {reserved > 0 && <span className="text-amber-400">{formatLakhs(reserved)} reserved</span>}
            <span className="text-emerald-400">{formatLakhs(remaining)} left</span>
          </div>
        </div>
      </div>

      {/* Squad composition */}
      <div className="relative px-6 pt-5 pb-6">
        <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Squad Composition
        </p>
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2 py-3 text-center">
            <p className="text-lg font-extrabold text-white">{composition.batters}</p>
            <p className="mt-1 text-[9px] font-semibold text-slate-500">🏏 Batters</p>
          </div>
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2 py-3 text-center">
            <p className="text-lg font-extrabold text-white">{composition.bowlers}</p>
            <p className="mt-1 text-[9px] font-semibold text-slate-500">🎾 Bowlers</p>
          </div>
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2 py-3 text-center">
            <p className="text-lg font-extrabold text-white">{composition.allRounders}</p>
            <p className="mt-1 text-[9px] font-semibold text-slate-500">⭐ All-Rounders</p>
          </div>
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2 py-3 text-center">
            <p className="text-lg font-extrabold text-white">{composition.wicketKeepers}</p>
            <p className="mt-1 text-[9px] font-semibold text-slate-500">🧤 Keepers</p>
          </div>
        </div>

        {/* Overseas slot visualizer */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">
              Overseas Slots
            </span>
            <span className={cn("text-xs font-extrabold", overseasFull ? "text-amber-400" : "text-sky-400")}>
              {overseasCount} / {franchise.maxOverseas}
            </span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: franchise.maxOverseas }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 flex-1 rounded-full",
                  i < overseasCount
                    ? "bg-gradient-to-r from-sky-400 to-indigo-400"
                    : "bg-white/[0.06]"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   TEAM ROSTER CARD
   ============================================================================= */
export function TeamRosterCard({
  franchise,
  players = [],
}: {
  franchise: Franchise;
  players?: Player[];
}) {
  // ── FIX: Null-safe filter ──
  const squad = useMemo(
    () => (players ?? []).filter((p) => franchise.squad?.includes(p.id) ?? false),
    [players, franchise.squad]
  );

  const overseasCount = squad.filter((p) => p.overseas).length;
  const squadFull = squad.length >= franchise.maxSquadSize;
  const overseasFull = overseasCount >= franchise.maxOverseas;

  const topSign = useMemo(
    () =>
      squad.reduce<Player | null>((top, p) => {
        if (p.soldPrice == null) return top;
        return top == null || (top.soldPrice ?? 0) < p.soldPrice ? p : top;
      }, null),
    [squad]
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.01] p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-3">
          <TeamEmblem franchise={franchise} size="sm" />
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
              <Shield className="h-3.5 w-3.5" /> Squad
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {squad.length} players · {overseasCount} overseas
            </p>
          </div>
        </div>
        {topSign && (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1">
            <Crown className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400">
              Top: {formatLakhs(topSign.soldPrice ?? 0)}
            </span>
          </div>
        )}
      </div>

      {/* Capacity warnings */}
      <div className="mx-5 mt-3 flex gap-2">
        {squadFull && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400/10 px-2 py-1 text-[9px] font-bold text-amber-400">
            <AlertTriangle className="h-3 w-3" /> Squad Full
          </span>
        )}
        {overseasFull && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-sky-400/10 px-2 py-1 text-[9px] font-bold text-sky-400">
            <Globe className="h-3 w-3" /> Overseas Full
          </span>
        )}
      </div>

      {/* Player list */}
      <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto px-5 pb-5">
        {squad.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-600">No players acquired yet</p>
        ) : (
          squad.map((p) => (
            <div
              key={p.id}
              className="group flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 transition hover:border-white/10 hover:bg-white/[0.04]"
            >
              <PlayerAvatar player={p} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-slate-200">{p.name}</p>
                  {p.id === topSign?.id && (
                    <Crown
                      className="h-3.5 w-3.5 shrink-0 text-amber-400"
                      aria-label="Most expensive signing"
                    />
                  )}
                  {p.overseas && (
                    <span className="shrink-0 rounded-full border border-sky-400/20 bg-sky-400/10 px-1.5 py-0.5 text-[8px] font-bold text-sky-400">
                      🌏 Overseas
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[10px] text-slate-400">
                    {ROLE_ICONS[p.role] ?? "🏏"} {p.role}
                  </span>
                  {p.battingStyle && (
                    <>
                      <span className="text-[10px] text-slate-600">·</span>
                      <span className="text-[10px] text-slate-500">{p.battingStyle}</span>
                    </>
                  )}
                  {p.bowlingStyle && (
                    <>
                      <span className="text-[10px] text-slate-600">·</span>
                      <span className="text-[10px] text-slate-500">{p.bowlingStyle}</span>
                    </>
                  )}
                  {p.age > 0 && (
                    <>
                      <span className="text-[10px] text-slate-600">·</span>
                      <span className="text-[10px] text-slate-500">{p.age} yrs</span>
                    </>
                  )}
                </div>
              </div>

              <span className="shrink-0 text-sm font-extrabold text-amber-400">
                {formatLakhs(p.soldPrice ?? 0)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Top buy footer */}
      {topSign && (
        <div className="mx-5 mb-5 flex items-center justify-center gap-2 rounded-xl border border-amber-400/10 bg-amber-400/[0.05] px-4 py-3">
          <Crown className="h-4 w-4 text-amber-400" />
          <span className="text-[11px] text-slate-400">Most expensive signing:</span>
          <span className="text-[11px] font-bold text-white">{topSign.name}</span>
          <span className="text-[11px] font-extrabold text-amber-400">
            {formatLakhs(topSign.soldPrice ?? 0)}
          </span>
        </div>
      )}
    </div>
  );
}