import { useMemo } from "react";
import { BarChart3, Loader2, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth, useLiveAuction } from "@/features/auction/hooks/index.hook";
import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { StatBar } from "@/features/auction/components/LiveStatistics";

export default function AuctionAnalyticsPage() {
  const { isAuthenticated, hasHydrated } = useAuth();
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);

  const {
    players,
    franchises,
    playersSoldCount,
    playersUnsoldCount,
    totalMoneySpent,
    status,
    connection,
  } = useLiveAuction(storeAuctionId || undefined, storeTournamentId || undefined);

  // Computed analytics
  const analytics = useMemo(() => {
    const soldPlayers = players.filter((p) => p.status === "sold");
    const maxSpend = Math.max(...franchises.map((f) => f.spent), 1);
    const roleCounts = (["Batter", "Bowler", "All-Rounder", "Wicket-Keeper"] as const).map(
      (role) => ({
        role,
        count: soldPlayers.filter((p) => p.role === role).length,
      })
    );
    const maxRole = Math.max(...roleCounts.map((r) => r.count), 1);
    const topBuys = [...soldPlayers]
      .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
      .slice(0, 6);
    const avgSold = playersSoldCount > 0 ? totalMoneySpent / playersSoldCount : 0;
    const sellThroughRate =
      players.length > 0
        ? Math.round(((playersSoldCount + playersUnsoldCount) / players.length) * 100)
        : 0;

    return {
      soldPlayers,
      maxSpend,
      roleCounts,
      maxRole,
      topBuys,
      avgSold,
      sellThroughRate,
    };
  }, [players, franchises, playersSoldCount, playersUnsoldCount, totalMoneySpent]);

  // Guards
  if (!hasHydrated) {
    return (
      <div className="mx-auto flex max-w-6xl items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 py-32 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Authentication Required</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Sign in to view auction analytics and insights.
        </p>
        <Link
          to="/login"
          className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (!storeAuctionId || !storeTournamentId) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 py-32 text-center">
        <BarChart3 className="h-12 w-12 text-slate-500" />
        <h2 className="text-lg font-bold text-white">No Active Auction</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Select a tournament from the dashboard to view analytics.
        </p>
        <Link
          to="/"
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const { soldPlayers, maxSpend, roleCounts, maxRole, topBuys, avgSold, sellThroughRate } =
    analytics;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-6xl space-y-6"
    >
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <BarChart3 className="h-5 w-5 text-amber-300" /> Auction Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Live insights derived from the same real-time snapshot powering the auction room.
        </p>
        {connection !== "connected" && (
          <p className="mt-2 text-xs text-amber-400">
            Data may be stale — reconnecting to live auction…
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Players Sold" value={`${playersSoldCount}`} />
        <MetricCard label="Players Unsold" value={`${playersUnsoldCount}`} />
        <MetricCard label="Avg. Sold Price" value={formatLakhs(Math.round(avgSold))} />
        <MetricCard label="Lots Resolved" value={`${sellThroughRate}%`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Spend by franchise */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Spend by Franchise</p>
          <div className="space-y-3">
            {franchises
              .slice()
              .sort((a, b) => b.spent - a.spent)
              .map((f) => (
                <div key={f.id} className="flex items-center gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${f.colorFrom}, ${f.colorTo})`,
                    }}
                  >
                    {initials(f.shortName)}
                  </span>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-300">{f.shortName}</span>
                      <span className="font-semibold text-slate-200">
                        {formatLakhs(f.spent)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(f.spent / maxSpend) * 100}%`,
                          background: `linear-gradient(90deg, ${f.colorFrom}, ${f.colorTo})`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            {franchises.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-600">No franchise data yet</p>
            )}
          </div>
        </div>

        {/* Role distribution */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Sold Players by Role</p>
          <div className="space-y-4">
            {roleCounts.map((r) => (
              <StatBar key={r.role} label={r.role} value={r.count} max={maxRole} />
            ))}
            {soldPlayers.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-600">No sales recorded yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Top buys */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="mb-4 text-sm font-semibold text-slate-300">Top Buys</p>
        {topBuys.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-600">No sales recorded yet</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topBuys.map((p, i) => {
              const f = franchises.find((fr) => fr.id === p.teamId);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.02] p-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/10 text-xs font-bold text-amber-300">
                    #{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">{p.name}</p>
                    <p className="truncate text-[10px] text-slate-500">{f?.name}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">
                    {formatLakhs(p.soldPrice ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}