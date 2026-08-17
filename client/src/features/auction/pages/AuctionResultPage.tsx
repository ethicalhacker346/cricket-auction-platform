import { useMemo, useState } from "react";
import { Trophy, Users, XCircle, Loader2, ShieldAlert, BarChart3, Ban, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, useLiveAuction } from "@/features/auction/hooks/index.hook";
import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { TeamBudgetCard, TeamRosterCard } from "@/features/auction/components/TeamCards";
import { TopBuyShareCard } from "@/features/auction/components/TopBuyShareCard";
import { AuctionStatusBadge } from "@/features/auction/components/Badges";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { cn } from "@/utils/cn";

type ResultTab = "teams" | "sold" | "unsold" | "permanent_unsold";

export default function AuctionResultPage() {
  const { isAuthenticated, hasHydrated } = useAuth();
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);

  const {
    players,
    franchises,
    status,
    connection,
    playersSoldCount,
    playersUnsoldCount,
    playersPermanentUnsoldCount,
    totalMoneySpent,
  } = useLiveAuction(storeAuctionId || undefined, storeTournamentId || undefined);

  const [tab, setTab] = useState<ResultTab>("teams");

  // Memoized data transforms
  const { sold, unsold, permanentUnsold, topBuy, avgSoldPrice } = useMemo(() => {
    const sold = players.filter((p) => p.status === "sold");
    const unsold = players.filter((p) => p.status === "unsold");
    const permanentUnsold = players.filter((p) => p.status === "permanent_unsold");
    const topBuy = [...sold].sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))[0];
    const avgSoldPrice = sold.length > 0 ? totalMoneySpent / sold.length : 0;
    return { sold, unsold, permanentUnsold, topBuy, avgSoldPrice };
  }, [players, totalMoneySpent]);

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
          Sign in to view auction results and team standings.
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
        <Trophy className="h-12 w-12 text-slate-500" />
        <h2 className="text-lg font-bold text-white">No Active Auction</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Select a tournament from the dashboard to view results.
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

  const isCompleted = status === "completed";
  const totalPlayers = players.length;
  const completionRate =
    totalPlayers > 0
      ? Math.round(
          ((playersSoldCount + playersUnsoldCount + (playersPermanentUnsoldCount ?? 0)) /
            totalPlayers) *
            100
        )
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-7xl space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl">
              <Trophy className="h-5 w-5 shrink-0 text-amber-300" /> Auction Results
            </h1>
            <AuctionStatusBadge status={status} />
          </div>
          <p className="text-sm text-slate-500">
            {isCompleted
              ? "Final results — all lots have been settled."
              : "Live results — auction is still in progress."}
          </p>
          {connection !== "connected" && (
            <p className="mt-1 text-xs text-amber-400">
              Data may be stale — reconnecting to live auction…
            </p>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:w-auto lg:shrink-0 lg:grid-cols-5">
          {[
            { label: "Sold", value: playersSoldCount, color: "text-emerald-400" },
            { label: "Unsold", value: playersUnsoldCount, color: "text-rose-400" },
            {
              label: "Perm. Unsold",
              value: playersPermanentUnsoldCount ?? 0,
              color: "text-slate-400",
            },
            { label: "Total Spent", value: formatLakhs(totalMoneySpent), color: "text-amber-400" },
            { label: "Completion", value: `${completionRate}%`, color: "text-sky-400" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-center sm:px-3 lg:min-w-[92px]"
            >
              <p className={cn("truncate text-sm font-bold", stat.color)}>{stat.value}</p>
              <p className="truncate text-[9px] uppercase tracking-wider text-slate-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Top buy highlight */}
      {topBuy && (
        <TopBuyShareCard
          player={topBuy}
          franchise={franchises.find((f) => f.id === topBuy.teamId)}
          avgSoldPrice={avgSoldPrice}
        />
      )}

      {/* Tabs */}
      <div className="w-full min-w-0">
        <div
          className={cn(
            "flex w-full min-w-0 gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1.5",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "sm:grid sm:grid-cols-4 sm:gap-2 sm:overflow-visible"
          )}
        >
          {([
            { key: "teams", label: "Team Standings", count: franchises.length },
            { key: "sold", label: "Sold", count: sold.length },
            { key: "unsold", label: "Unsold", count: unsold.length },
            { key: "permanent_unsold", label: "Perm. Unsold", count: permanentUnsold.length },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "relative shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition sm:w-full sm:px-3 sm:text-center",
                tab === key ? "text-slate-950" : "text-slate-300 hover:text-white"
              )}
            >
              {tab === key && (
                <motion.span
                  layoutId="resultTabIndicator"
                  className="absolute inset-0 rounded-xl bg-amber-400 shadow-lg shadow-amber-400/20"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                {label}
                <span
                  className={cn(
                    "inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                    tab === key ? "bg-slate-950/15 text-slate-950" : "bg-white/10 text-slate-400"
                  )}
                >
                  {count}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab === "teams" && (
          <motion.div
            key="teams"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {franchises.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
                <Users className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-500">No franchise data available yet.</p>
              </div>
            ) : (
              franchises
                .slice()
                .sort((a, b) => b.spent - a.spent)
                .map((f) => (
                  <div
                    key={f.id}
                    className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
                  >
                    <TeamBudgetCard franchise={f} players={players}/>
                    <TeamRosterCard franchise={f} players={players} />
                  </div>
                ))
            )}
          </motion.div>
        )}

        {tab === "sold" && (
  <motion.div
    key="sold"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    className="w-full min-w-0 overflow-hidden rounded-2xl border border-white/10"
  >
    <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-slate-400">
          <tr>
            <th className="whitespace-nowrap px-4 py-3">Player</th>
            <th className="whitespace-nowrap px-4 py-3">Role</th>
            <th className="whitespace-nowrap px-4 py-3">Franchise</th>
            <th className="whitespace-nowrap px-4 py-3 text-right">
              Sold Price
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-white/5">
          {sold.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-10 text-center text-xs text-slate-600"
              >
                No players sold yet.
              </td>
            </tr>
          ) : (
            sold
              .slice()
              .sort(
                (a, b) =>
                  (b.soldPrice ?? 0) - (a.soldPrice ?? 0)
              )
              .map((p) => {
                const f = franchises.find(
                  (fr) => fr.id === p.teamId
                );

                return (
                  <tr
                    key={p.id}
                    className="bg-white/[0.015] transition hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-xs font-bold text-amber-400">
                          #{sold.findIndex((s) => s.id === p.id) + 1}
                        </span>

                        <span className="max-w-[220px] truncate text-slate-200">
                          {p.name}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {p.role}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {f && (
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                            style={{
                              background: `linear-gradient(135deg, ${f.colorFrom}, ${f.colorTo})`,
                            }}
                          >
                            {initials(f.shortName)}
                          </span>
                        )}

                        <span className="max-w-[220px] truncate text-slate-300">
                          {f?.name ?? "—"}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-400">
                      {formatLakhs(p.soldPrice ?? 0)}
                    </td>
                  </tr>
                );
              })
          )}
        </tbody>
      </table>
    </div>
  </motion.div>
)}

        {tab === "unsold" && (
          <motion.div
            key="unsold"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            {unsold.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <Users className="h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-500">No unsold players remaining.</p>
                {isCompleted && permanentUnsold.length === 0 && (
                  <p className="text-xs text-slate-600">
                    Every player found a franchise — clean sweep!
                  </p>
                )}
                {isCompleted && permanentUnsold.length > 0 && (
                  <p className="text-xs text-slate-600">
                    All remaining players were either sold or permanently removed.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {unsold.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.02] p-3 transition hover:bg-white/[0.04]"
                  >
                    <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {p.role} · Base {formatLakhs(p.basePrice)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === "permanent_unsold" && (
          <motion.div
            key="permanent_unsold"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            {permanentUnsold.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <Ban className="h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-500">No permanently unsold players.</p>
                {isCompleted && (
                  <p className="text-xs text-slate-600">
                    All players were either sold or remain in the unsold pool.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-xl border border-slate-500/10 bg-slate-500/5 p-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <p className="text-xs leading-relaxed text-slate-500">
                    These players have been permanently removed from the auction pool by the
                    organizer. They will not appear in future unsold rounds and are no longer
                    eligible for bidding.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {permanentUnsold.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-slate-500/20 hover:bg-white/[0.04]"
                    >
                      <Ban className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-300">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {p.role} · Base {formatLakhs(p.basePrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}