import { AnimatePresence, motion } from "framer-motion";
import { Activity, History } from "lucide-react";
import { useAuctionLogs, useBidHistory } from "@/features/auction/hooks/index.hook";
import { LOG_ICON } from "@/features/auction/constants/index.constants";
import { formatLakhs, initials, timeAgo } from "@/features/auction/utils/index.utils";

export function BidHistoryPanel({ playerId, limit = 12 }: { playerId?: string; limit?: number }) {
  const bids = useBidHistory(playerId, limit);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
        <History className="h-3.5 w-3.5" /> Live Bid Feed
      </p>
      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {bids.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-6 text-center text-xs text-slate-600"
            >
              No bids placed yet
            </motion.p>
          )}
          {bids.map((bid) => (
            <motion.div
              key={bid.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{
                    background: bid.franchise
                      ? `linear-gradient(135deg, ${bid.franchise.colorFrom}, ${bid.franchise.colorTo})`
                      : "#334155",
                  }}
                >
                  {bid.franchise ? initials(bid.franchise.shortName) : "?"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-200">
                    {bid.franchise?.shortName ?? "Unknown"}
                    {bid.isUser && <span className="ml-1 text-sky-400">(You)</span>}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">{bid.player?.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-amber-400">{formatLakhs(bid.amount)}</p>
                <p className="text-[9px] text-slate-600">{timeAgo(bid.timestamp)}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function AuctionLogs({ limit = 16 }: { limit?: number }) {
  const logs = useAuctionLogs(limit);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
        <Activity className="h-3.5 w-3.5" /> Activity Timeline
      </p>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {logs.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-600">Nothing has happened yet</p>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5">{LOG_ICON[log.type] ?? "•"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-slate-300">{log.message}</p>
              <p className="text-[10px] text-slate-600">{timeAgo(log.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}