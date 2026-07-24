import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, User, Hexagon, AlertTriangle } from "lucide-react";
import { useLiveAuction, useUserTeam } from "@/features/auction/hooks/index.hook";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { cn } from "@/utils/cn";
import type { Franchise, Player } from "@/features/auction/types/index.types";

/* =============================================================================
   IMAGE FALLBACK HOOK
   ============================================================================= */
function useImageFallback(src?: string) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return { showImage: Boolean(src) && !failed, onError: () => setFailed(true) };
}

/* =============================================================================
   FRANCHISE EMBLEM
   ============================================================================= */
function FranchiseEmblem({
  franchise,
  size = "md",
}: {
  franchise: Franchise;
  size?: "sm" | "md";
}) {
  const { showImage, onError } = useImageFallback(franchise.logo);
  const dims = size === "md" ? "h-12 w-12 text-sm" : "h-8 w-8 text-[10px]";

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl font-extrabold text-white shadow-lg",
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
   BUDGET BAR
   ============================================================================= */
function BudgetBar({
  remaining,
  total,
  reserved,
}: {
  remaining: number;
  total: number;
  reserved: number;
}) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  const barColor =
    pct > 40
      ? "from-emerald-400 to-emerald-500"
      : pct > 15
      ? "from-amber-400 to-amber-500"
      : "from-rose-500 to-rose-600";

  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={cn("h-full rounded-full bg-gradient-to-r", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] font-medium text-slate-500">
        {formatLakhs(remaining)} left
        {reserved > 0 && (
          <span className="text-amber-400/80"> · {formatLakhs(reserved)} reserved</span>
        )}
      </p>
    </div>
  );
}

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */
export function FranchisePanel() {
  // ── FIX: pull players from live store so we can compute real overseas counts ──
  const { franchises, currentBid, players } = useLiveAuction();
  const userTeam = useUserTeam(franchises);

  if (franchises.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          <Hexagon className="h-4 w-4" /> Franchises
        </p>
        <p className="py-8 text-center text-sm text-slate-600">Loading franchise data…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <Wallet className="h-4 w-4" /> Franchises
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {franchises.map((f) => {
          const reserved = f.reservedBudget ?? 0;
          const remaining = f.purseTotal - f.spent - reserved;
          const squadCount = f.squad?.length ?? 0;
          const isLeading = currentBid?.teamId === f.id;
          const isUser = f.id === userTeam?.id;
          const squadFull = squadCount >= f.maxSquadSize;

          // ── FIX: Compute overseas count by looking up actual player data ──
          const overseasCount = (f.squad ?? []).reduce((count, playerId) => {
            const p = players.find((pl: Player) => pl.id === playerId);
            return count + (p?.overseas ? 1 : 0);
          }, 0);
          const overseasFull = overseasCount >= f.maxOverseas;

          return (
            <motion.div
              key={f.id}
              animate={isLeading ? { scale: [1, 1.03, 1] } : {}}
              transition={{
                duration: 0.6,
                repeat: isLeading ? Infinity : 0,
                repeatDelay: 0.8,
              }}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-4 transition",
                isLeading
                  ? "border-amber-400/40 bg-amber-400/[0.06] shadow-lg shadow-amber-500/5"
                  : isUser
                  ? "border-sky-400/30 bg-sky-400/[0.04]"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
              )}
            >
              {/* Ambient glow */}
              {isLeading && (
                <div
                  className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl"
                  style={{ background: "hsl(45 90% 55% / 0.1)" }}
                />
              )}

              {/* Badges */}
              {isLeading && (
                <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-950 shadow-lg">
                  Leading
                </span>
              )}
              {isUser && !isLeading && (
                <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-sky-400 to-indigo-400 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-lg">
                  You
                </span>
              )}

              {/* Identity */}
              <div className="flex items-center gap-3">
                <FranchiseEmblem franchise={f} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{f.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{f.owner}</span>
                  </p>
                </div>
              </div>

              {/* 3-up stats */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-black/20 px-1 py-2 text-center">
                  <p
                    className={cn(
                      "text-sm font-extrabold",
                      remaining < 0
                        ? "text-rose-400"
                        : remaining < f.purseTotal * 0.15
                        ? "text-amber-400"
                        : "text-emerald-400"
                    )}
                  >
                    {formatLakhs(remaining)}
                  </p>
                  <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
                    Left
                  </p>
                </div>
                <div className="rounded-xl bg-black/20 px-1 py-2 text-center">
                  <p className={cn("text-sm font-extrabold", squadFull && "text-amber-400")}>
                    {squadCount}/{f.maxSquadSize}
                  </p>
                  <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
                    Squad
                  </p>
                </div>
                <div className="rounded-xl bg-black/20 px-1 py-2 text-center">
                  <p className={cn("text-sm font-extrabold", overseasFull && "text-amber-400")}>
                    {overseasCount}/{f.maxOverseas}
                  </p>
                  <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
                    Overseas
                  </p>
                </div>
              </div>

              {/* Budget bar */}
              <BudgetBar remaining={remaining} total={f.purseTotal} reserved={reserved} />

              {/* Warnings */}
              {squadFull && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-1.5">
                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                  <span className="text-[9px] font-semibold text-amber-400">
                    Squad full — cannot bid
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}