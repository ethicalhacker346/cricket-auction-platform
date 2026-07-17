import { useMemo, useState } from "react";
import { History, Loader2, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  useAuth,
  useBidHistory,
  useLiveAuction,
} from "@/features/auction/hooks/index.hook";
import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { formatLakhs, initials, timeAgo } from "@/features/auction/utils/index.utils";

export default function AuctionHistoryPage() {
  const { isAuthenticated, hasHydrated } = useAuth();
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);

  // Bootstrap live connection so rounds + franchises populate
  const { rounds, franchises, connection } = useLiveAuction(
    storeAuctionId || undefined,
    storeTournamentId || undefined
  );

  const [roundFilter, setRoundFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const bids = useBidHistory(undefined, 500);

  const filtered = useMemo(
    () =>
      bids.filter(
        (b) =>
          (roundFilter === "all" || b.roundId === roundFilter) &&
          (teamFilter === "all" || b.teamId === teamFilter)
      ),
    [bids, roundFilter, teamFilter]
  );

  if (!hasHydrated) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-4 py-32 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Authentication Required</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Please sign in to view bid history and auction analytics.
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

  const isLoading = connection === "connecting" || connection === "reconnecting";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-5xl space-y-6"
    >
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <History className="h-5 w-5 text-amber-300" /> Bid History
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Full timeline of every bid placed across the auction so far.
        </p>
        {connection === "offline" && (
          <p className="mt-2 text-xs font-medium text-rose-400">
            Offline — reconnecting to live auction…
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={roundFilter}
          onChange={(e) => setRoundFilter(e.target.value)}
          disabled={isLoading}
          className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50 disabled:opacity-50"
        >
          <option value="all">All rounds</option>
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          disabled={isLoading}
          className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50 disabled:opacity-50"
        >
          <option value="all">All franchises</option>
          {franchises.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          {filtered.length} bids
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Franchise</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-xs text-slate-600">
                  {isLoading
                    ? "Loading bid history from server…"
                    : "No bids match your filters yet."}
                </td>
              </tr>
            )}
            {filtered.map((bid) => (
              <tr
                key={bid.id}
                className="bg-white/[0.015] transition hover:bg-white/[0.04]"
              >
                <td className="px-4 py-3 text-slate-200">
                  {bid.player?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{
                        background: bid.franchise
                          ? `linear-gradient(135deg, ${bid.franchise.colorFrom}, ${bid.franchise.colorTo})`
                          : "#334155",
                      }}
                    >
                      {bid.franchise ? initials(bid.franchise.shortName) : "?"}
                    </span>
                    <span className="text-slate-300">
                      {bid.franchise?.name ?? "Unknown"}
                    </span>
                    {bid.isUser && (
                      <span className="text-[10px] text-sky-400">(You)</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-amber-400">
                  {formatLakhs(bid.amount)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {timeAgo(bid.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}