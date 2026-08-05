import { useMemo } from "react";
import {
  Award,
  BarChart3,
  Clock,
  Crown,
  Flame,
  Globe2,
  Loader2,
  MapPin,
  Medal,
  Radio,
  ShieldAlert,
  Users,
  Ban,
  Wallet,
  TrendingUp,
  PieChart as PieChartIcon,
  Activity,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth, useLiveAuction } from "@/features/auction/hooks/index.hook";
import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { formatLakhs, initials, timeAgo } from "@/features/auction/utils/index.utils";
import { FranchiseLogo, PlayerAvatar, ROLE_META, StatBar } from "@/features/auction/components/LiveStatistics";
import {
  StatusDistributionChart,
  RoleDistributionChart,
  OverseasDomesticChart,
  FranchiseSpendingChart,
  TopBuysChart,
  RolePriceChart,
  BiddingActivityChart,
  PriceDistributionChart,
  FranchiseBalanceChart,
  CategoryBreakdownChart,
  MostContestedChart,
  SpendingTrendChart,
} from "@/features/auction/components/AuctionCharts";
import type { Franchise, Player, PlayerRole } from "@/features/auction/types/index.types";

const ROLES: PlayerRole[] = ["Batter", "Bowler", "All-Rounder", "Wicket-Keeper"];
const MEDAL_STYLES = [
  "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
  "bg-slate-300/15 text-slate-300 ring-1 ring-slate-300/30",
  "bg-orange-600/15 text-orange-400 ring-1 ring-orange-600/30",
];

export default function AuctionAnalyticsPage() {
  const { isAuthenticated, hasHydrated } = useAuth();
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);

  const {
    auction,
    players,
    franchises,
    bidHistory,
    playersSoldCount,
    playersUnsoldCount,
    playersPermanentUnsoldCount,
    totalMoneySpent,
    connection,
    viewerCount,
  } = useLiveAuction({
    auctionId: storeAuctionId || undefined,
    tournamentId: storeTournamentId || undefined,
  });

  // ==========================================================================
  // Derived analytics — everything below is computed client-side from the
  // same live snapshot that powers the auction room, so it stays in lockstep
  // with sold/unsold events in real time without a separate fetch.
  // ==========================================================================
  const analytics = useMemo(() => {
    const soldPlayers = players.filter((p) => p.status === "sold");
    const maxSpend = Math.max(...franchises.map((f) => f.spent), 1);
    const permanentUnsoldCount = players.filter((p) => p.status === "permanent_unsold").length;

    const roleCounts = ROLES.map((role) => ({
      role,
      count: soldPlayers.filter((p) => p.role === role).length,
    }));
    const maxRole = Math.max(...roleCounts.map((r) => r.count), 1);

    const categoryCounts: { key: string; label: string; count: number }[] = [
      { key: "marquee", label: "Marquee", count: soldPlayers.filter((p) => p.tag === "marquee").length },
      { key: "star", label: "Star", count: soldPlayers.filter((p) => p.tag === "star").length },
      { key: "uncapped", label: "Uncapped", count: soldPlayers.filter((p) => p.tag === "uncapped").length },
      { key: "other", label: "Unclassified", count: soldPlayers.filter((p) => !p.tag).length },
    ].filter((c) => c.count > 0);
    const maxCategory = Math.max(...categoryCounts.map((c) => c.count), 1);

    const overseasCount = soldPlayers.filter((p) => p.overseas).length;
    const domesticCount = soldPlayers.length - overseasCount;

    const topBuys = [...soldPlayers]
      .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
      .slice(0, 6);

    const recentSales = [...soldPlayers]
      .sort((a, b) => {
        const at = a.soldAt ? new Date(a.soldAt).getTime() : 0;
        const bt = b.soldAt ? new Date(b.soldAt).getTime() : 0;
        return bt - at;
      })
      .slice(0, 6);

    const avgSold = playersSoldCount > 0 ? totalMoneySpent / playersSoldCount : 0;
    const sellThroughRate =
      players.length > 0
        ? Math.round(
            ((playersSoldCount + playersUnsoldCount + permanentUnsoldCount) / players.length) * 100
          )
        : 0;

    const franchiseBoard = [...franchises]
      .sort((a, b) => b.spent - a.spent)
      .map((f) => {
        const squadOverseas = players.filter((p) => p.teamId === f.id && p.overseas).length;
        const remaining = Math.max(f.purseTotal - f.spent - (f.reservedBudget || 0), 0);
        const topBuy = players
          .filter((p) => p.teamId === f.id && p.status === "sold")
          .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))[0];
        return { franchise: f, squadOverseas, remaining, topBuy };
      });

    // Bidding intensity — which lots drew the most competing bids.
    const bidCounts = new Map<string, number>();
    for (const b of bidHistory) bidCounts.set(b.playerId, (bidCounts.get(b.playerId) ?? 0) + 1);
    const mostContested = [...bidCounts.entries()]
      .map(([playerId, count]) => ({ player: players.find((p) => p.id === playerId), count }))
      .filter((x): x is { player: Player; count: number } => !!x.player && x.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      soldPlayers,
      maxSpend,
      roleCounts,
      maxRole,
      categoryCounts,
      maxCategory,
      overseasCount,
      domesticCount,
      topBuys,
      recentSales,
      avgSold,
      sellThroughRate,
      franchiseBoard,
      mostContested,
      permanentUnsoldCount,
    };
  }, [players, franchises, bidHistory, playersSoldCount, playersUnsoldCount, totalMoneySpent]);

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

  const {
    maxSpend,
    roleCounts,
    maxRole,
    categoryCounts,
    maxCategory,
    overseasCount,
    domesticCount,
    topBuys,
    recentSales,
    avgSold,
    sellThroughRate,
    franchiseBoard,
    mostContested,
    permanentUnsoldCount,
  } = analytics;

  const highestSale = topBuys[0];
  const soldTotal = overseasCount + domesticCount;
  const connectionMeta =
    connection === "connected"
      ? { label: "Live", dot: "bg-emerald-400", text: "text-emerald-300" }
      : connection === "reconnecting" || connection === "connecting"
      ? { label: "Reconnecting", dot: "bg-amber-400 animate-pulse", text: "text-amber-300" }
      : { label: "Offline", dot: "bg-rose-400", text: "text-rose-300" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white">
            <BarChart3 className="h-5 w-5 text-amber-300" /> Auction Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {auction?.name ? `${auction.name} — ` : ""}
            Live insights derived from the same real-time snapshot powering the auction room.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold">
            <span className={`h-1.5 w-1.5 rounded-full ${connectionMeta.dot}`} />
            <span className={connectionMeta.text}>{connectionMeta.label}</span>
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300">
            <Radio className="h-3 w-3 text-cyan-300" /> {viewerCount ?? 0} watching
          </span>
        </div>
      </div>
      {connection !== "connected" && (
        <p className="-mt-4 text-xs text-amber-400">Data may be stale — reconnecting to live auction…</p>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <MetricCard label="Sold" value={`${playersSoldCount}`} icon={Award} accent="text-emerald-300" />
        <MetricCard label="Unsold" value={`${playersUnsoldCount}`} icon={Users} accent="text-rose-300" />
        <MetricCard label="Perm. Unsold" value={`${permanentUnsoldCount}`} icon={Ban} accent="text-slate-400" />
        <MetricCard label="Total Spent" value={formatLakhs(totalMoneySpent)} icon={Wallet} accent="text-amber-300" />
        <MetricCard label="Avg. Price" value={formatLakhs(Math.round(avgSold))} icon={BarChart3} accent="text-violet-300" />
        <MetricCard label="Highest" value={highestSale ? formatLakhs(highestSale.soldPrice ?? 0) : "—"} icon={Crown} accent="text-amber-300" sub={highestSale?.name} />
        <MetricCard label="Resolved" value={`${sellThroughRate}%`} icon={Clock} accent="text-sky-300" />
        <MetricCard label="Watching" value={`${viewerCount ?? 0}`} icon={Radio} accent="text-cyan-300" />
      </div>

      {/* ========== CHARTS DASHBOARD ========== */}

      {/* Row 1: Settlement Overview — 3 pie charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatusDistributionChart
          players={players}
          playersSoldCount={playersSoldCount}
          playersUnsoldCount={playersUnsoldCount}
          playersPermanentUnsoldCount={playersPermanentUnsoldCount}
        />
        <RoleDistributionChart soldPlayers={analytics.soldPlayers} />
        <OverseasDomesticChart soldPlayers={analytics.soldPlayers} />
      </div>

      {/* Row 2: Spending & Trend — 2 wide charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FranchiseSpendingChart franchises={franchises} />
        <SpendingTrendChart bidHistory={bidHistory} />
      </div>

      {/* Row 3: Price Analysis — 2 charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopBuysChart soldPlayers={analytics.soldPlayers} />
        <PriceDistributionChart soldPlayers={analytics.soldPlayers} />
      </div>

      {/* Row 4: Role & Category Deep Dive — 3 charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <RolePriceChart soldPlayers={analytics.soldPlayers} />
        <CategoryBreakdownChart soldPlayers={analytics.soldPlayers} />
        <BiddingActivityChart bidHistory={bidHistory} />
      </div>

      {/* Row 5: Competitive & Balance — 2 charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MostContestedChart bidHistory={bidHistory} players={players} />
        <FranchiseBalanceChart franchises={franchises} players={players} />
      </div>

      {/* ========== EXISTING RICH DATA SECTIONS ========== */}

      {/* Franchise leaderboard */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-300">Franchise Leaderboard</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-600">Sorted by spend</p>
        </div>
        {franchiseBoard.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-600">No franchise data yet</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {franchiseBoard.map(({ franchise: f, squadOverseas, remaining, topBuy }, i) => {
              const spentPct = f.purseTotal > 0 ? Math.min(100, (f.spent / f.purseTotal) * 100) : 0;
              const reservedPct = f.purseTotal > 0 ? Math.min(100 - spentPct, ((f.reservedBudget || 0) / f.purseTotal) * 100) : 0;
              const squadPct = f.maxSquadSize > 0 ? Math.min(100, (f.squad.length / f.maxSquadSize) * 100) : 0;
              return (
                <div key={f.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-start gap-3">
                    <FranchiseLogo franchise={f} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-white">{f.name || f.shortName}</p>
                        {i === 0 && f.spent > 0 && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
                      </div>
                      <p className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                        {f.city && (
                          <>
                            <MapPin className="h-2.5 w-2.5" /> {f.city} ·{" "}
                          </>
                        )}
                        {f.owner}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-sm font-bold text-amber-300">
                      {formatLakhs(f.spent)}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Purse utilised</span>
                      <span className="text-slate-400">{formatLakhs(remaining)} left</span>
                    </div>
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-rose-400"
                        style={{ width: `${spentPct}%` }}
                      />
                      <div className="h-full bg-slate-400/40" style={{ width: `${reservedPct}%` }} />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-slate-500">
                        <span>Squad</span>
                        <span className="text-slate-300">
                          {f.squad.length}/{f.maxSquadSize}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-sky-400" style={{ width: `${squadPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-slate-500">
                        <span className="flex items-center gap-1">
                          <Globe2 className="h-2.5 w-2.5" /> Overseas
                        </span>
                        <span className="text-slate-300">
                          {squadOverseas}/{f.maxOverseas}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-violet-400"
                          style={{ width: `${f.maxOverseas > 0 ? Math.min(100, (squadOverseas / f.maxOverseas) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {topBuy && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-2">
                      <PlayerAvatar player={topBuy} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">
                        Top buy: <span className="text-slate-200">{topBuy.name}</span>
                      </span>
                      <span className="shrink-0 text-[11px] font-bold text-emerald-400">
                        {formatLakhs(topBuy.soldPrice ?? 0)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Role distribution */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Sold Players by Role</p>
          <div className="space-y-4">
            {roleCounts.map((r) => {
              const meta = ROLE_META[r.role];
              return (
                <StatBar
                  key={r.role}
                  label={r.role}
                  value={r.count}
                  max={maxRole}
                  icon={meta.icon}
                  barClassName={
                    r.role === "Batter"
                      ? "from-sky-400 to-sky-500"
                      : r.role === "Bowler"
                      ? "from-rose-400 to-rose-500"
                      : r.role === "All-Rounder"
                      ? "from-amber-400 to-amber-500"
                      : "from-emerald-400 to-emerald-500"
                  }
                />
              );
            })}
            {roleCounts.every((r) => r.count === 0) && (
              <p className="py-6 text-center text-xs text-slate-600">No sales recorded yet</p>
            )}
          </div>
        </div>

        {/* Category distribution */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Sold Players by Category</p>
          <div className="space-y-4">
            {categoryCounts.map((c) => (
              <StatBar
                key={c.key}
                label={c.label}
                value={c.count}
                max={maxCategory}
                barClassName="from-fuchsia-400 to-indigo-400"
              />
            ))}
            {categoryCounts.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-600">No sales recorded yet</p>
            )}
          </div>
          {soldTotal > 0 && (
            <div className="mt-5 border-t border-white/5 pt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Globe2 className="h-3 w-3" /> Overseas vs Domestic
                </span>
                <span className="text-slate-300">
                  {overseasCount} / {domesticCount}
                </span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-violet-400"
                  style={{ width: `${(overseasCount / soldTotal) * 100}%` }}
                />
                <div
                  className="h-full bg-sky-400"
                  style={{ width: `${(domesticCount / soldTotal) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top buys */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Top Buys</p>
          {topBuys.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-600">No sales recorded yet</p>
          ) : (
            <div className="space-y-2.5">
              {topBuys.map((p, i) => {
                const f = franchises.find((fr) => fr.id === p.teamId);
                const meta = ROLE_META[p.role];
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/[0.02] p-2.5">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        i < 3 ? MEDAL_STYLES[i] : "bg-white/5 text-slate-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <PlayerAvatar player={p} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-200">{p.name}</p>
                      <p className="flex items-center gap-1 truncate text-[10px] text-slate-500">
                        <meta.icon className="h-2.5 w-2.5" /> {p.role}
                        {f && (
                          <>
                            {" "}
                            · {f.shortName}
                          </>
                        )}
                      </p>
                    </div>
                    {f && <FranchiseLogo franchise={f} size="xs" />}
                    <span className="shrink-0 text-sm font-bold text-emerald-400">
                      {formatLakhs(p.soldPrice ?? 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent sales + most contested */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="mb-4 text-sm font-semibold text-slate-300">Recent Sales</p>
            {recentSales.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-600">No sales recorded yet</p>
            ) : (
              <div className="space-y-2">
                {recentSales.map((p) => {
                  const f = franchises.find((fr) => fr.id === p.teamId);
                  return (
                    <div key={p.id} className="flex items-center gap-2.5 text-xs">
                      <PlayerAvatar player={p} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-slate-300">{p.name}</span>
                      {f && <span className="shrink-0 truncate text-slate-500">{f.shortName}</span>}
                      <span className="shrink-0 font-semibold text-emerald-400">
                        {formatLakhs(p.soldPrice ?? 0)}
                      </span>
                      {p.soldAt && (
                        <span className="shrink-0 text-[10px] text-slate-600">{timeAgo(new Date(p.soldAt).getTime())}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {mostContested.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-300">
                <Flame className="h-4 w-4 text-orange-400" /> Most Contested Lots
              </p>
              <div className="space-y-2">
                {mostContested.map(({ player, count }) => (
                  <div key={player.id} className="flex items-center gap-2.5 text-xs">
                    <PlayerAvatar player={player} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-slate-300">{player.name}</span>
                    <span className="shrink-0 rounded-full bg-orange-500/10 px-2 py-0.5 font-semibold text-orange-300">
                      {count} bids
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
      {Icon && <Icon className={`mx-auto mb-1 h-4 w-4 ${accent ?? "text-slate-400"}`} />}
      <p className="text-xl font-black text-white">{value}</p>
      <p className="mt-1 truncate text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 truncate text-[9px] text-slate-600">{sub}</p>}
    </div>
  );
}