import { useMemo, useState } from "react";
import { Trophy, Users, XCircle, Loader2, ShieldAlert, BarChart3, Ban, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, useLiveAuction } from "@/features/auction/hooks/index.hook";
import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { TeamBudgetCard, TeamRosterCard } from "@/features/auction/components/TeamCards";
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
      className="mx-auto max-w-6xl space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-2xl font-black text-white">
              <Trophy className="h-5 w-5 text-amber-300" /> Auction Results
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
        <div className="flex flex-wrap gap-2">
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
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center"
            >
              <p className={cn("text-sm font-bold", stat.color)}>{stat.value}</p>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top buy highlight */}
      {topBuy && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-400/10 to-transparent p-5"
        >
          <p className="mb-2 text-[10px] uppercase tracking-widest text-amber-400">
            Top Buy of the Auction
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xl font-black text-white">{topBuy.name}</p>
              <p className="text-xs text-slate-400">
                {topBuy.role} · Sold to{" "}
                {franchises.find((f) => f.id === topBuy.teamId)?.name ?? "Unknown"}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-black text-emerald-400">
                {formatLakhs(topBuy.soldPrice ?? 0)}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Avg: {formatLakhs(Math.round(avgSoldPrice))}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
        {(["teams", "sold", "unsold", "permanent_unsold"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg px-3.5 py-2 text-xs font-semibold capitalize transition",
              tab === t
                ? "bg-amber-400 text-slate-950"
                : "text-slate-300 hover:text-white"
            )}
          >
            {t === "teams"
              ? "Team Standings"
              : t === "permanent_unsold"
              ? "Perm. Unsold"
              : t}
            <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]">
              {t === "teams"
                ? franchises.length
                : t === "sold"
                ? sold.length
                : t === "unsold"
                ? unsold.length
                : permanentUnsold.length}
            </span>
          </button>
        ))}
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
                    <TeamBudgetCard franchise={f} />
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
            className="overflow-hidden rounded-2xl border border-white/10"
          >
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Franchise</th>
                  <th className="px-4 py-3 text-right">Sold Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sold.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-xs text-slate-600">
                      No players sold yet.
                    </td>
                  </tr>
                ) : (
                  sold
                    .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
                    .map((p) => {
                      const f = franchises.find((fr) => fr.id === p.teamId);
                      return (
                        <tr
                          key={p.id}
                          className="bg-white/[0.015] transition hover:bg-white/[0.04]"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-amber-400">
                                #{sold.findIndex((s) => s.id === p.id) + 1}
                              </span>
                              <span className="text-slate-200">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{p.role}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {f && (
                                <span
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                  style={{
                                    background: `linear-gradient(135deg, ${f.colorFrom}, ${f.colorTo})`,
                                  }}
                                >
                                  {initials(f.shortName)}
                                </span>
                              )}
                              <span className="text-slate-300">{f?.name ?? "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                            {formatLakhs(p.soldPrice ?? 0)}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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