import { ListOrdered, Users, Loader2 } from "lucide-react";
import { useLiveAuction } from "@/features/auction/hooks/index.hook";
import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { ROLE_ICONS } from "@/features/auction/constants/index.constants";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { RoundStatusBadge } from "./Badges";
import { cn } from "@/utils/cn";

export function PlayerQueue() {
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);

  const { upcomingPlayers, currentPlayer, status } = useLiveAuction(
    storeAuctionId || undefined,
    storeTournamentId || undefined
  );

  const isLive = status === "live";
  const hasQueue = upcomingPlayers.length > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <Users className="h-3.5 w-3.5" /> Up Next
        </p>
        {isLive && currentPlayer && (
          <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-medium text-amber-300">
            Live
          </span>
        )}
      </div>

      <div className="space-y-2">
        {!hasQueue && !currentPlayer && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Users className="h-6 w-6 text-slate-700" />
            <p className="text-xs text-slate-500">No players queued</p>
            <p className="text-[10px] text-slate-600">Auction may be paused or completed</p>
          </div>
        )}

        {!hasQueue && currentPlayer && (
          <p className="py-4 text-center text-xs text-slate-500">
            Last player on the block — queue empty after this lot
          </p>
        )}

        {upcomingPlayers.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center gap-2.5 rounded-lg bg-white/[0.02] px-2.5 py-2 transition hover:bg-white/[0.04]"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-bold text-slate-400">
              {i + 1}
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[10px] font-bold text-white">
              {initials(p.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-200">{p.name}</p>
              <p className="truncate text-[10px] text-slate-500">
                {ROLE_ICONS[p.role]} {p.role}
              </p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">
              {formatLakhs(p.basePrice)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoundProgress() {
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);

  const { rounds, currentRoundId, status } = useLiveAuction(
    storeAuctionId || undefined,
    storeTournamentId || undefined
  );

  const sorted = [...rounds].sort((a, b) => a.order - b.order);
  const completedCount = sorted.filter((r) => r.status === "completed").length;
  const totalCount = sorted.length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <ListOrdered className="h-3.5 w-3.5" /> Round Progress
        </p>
        {totalCount > 0 && (
          <span className="text-[10px] text-slate-500">
            {completedCount}/{totalCount} done
          </span>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      )}

      <div className="space-y-1.5">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <ListOrdered className="h-5 w-5 text-slate-700" />
            <p className="text-xs text-slate-500">No rounds configured</p>
          </div>
        )}

        {sorted.map((r) => {
          const isCurrent = r.id === currentRoundId;
          const isCompleted = r.status === "completed";
          const isActive = r.status === "active";

          return (
            <div
              key={r.id}
              className={cn(
                "flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition",
                isCurrent
                  ? "bg-amber-400/10 ring-1 ring-amber-400/30"
                  : isActive
                  ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
                  : isCompleted
                  ? "bg-white/[0.02] opacity-60"
                  : "bg-white/[0.02]"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                    isCurrent
                      ? "bg-amber-400/20 text-amber-300"
                      : isCompleted
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-white/5 text-slate-500"
                  )}
                >
                  {isCompleted ? "✓" : r.order}
                </span>
                <span
                  className={cn(
                    "font-medium",
                    isCurrent ? "text-amber-300" : isActive ? "text-emerald-300" : "text-slate-300"
                  )}
                >
                  {r.name}
                </span>
              </div>
              <RoundStatusBadge status={r.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}