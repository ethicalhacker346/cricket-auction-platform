import { AnimatePresence, motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { useLiveAuction } from "@/features/auction/hooks/index.hook";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";

export function CurrentHighestBid() {
  const { currentBid, leadingFranchise, currentPlayer, nextBidAmount } = useLiveAuction();

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5 text-center">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-400/90">
        <TrendingUp className="h-3.5 w-3.5" /> Current Highest Bid
      </p>
      <AnimatePresence mode="wait">
        <motion.p
          key={currentBid.amount}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="text-4xl font-black tracking-tight text-white sm:text-5xl"
        >
          {currentPlayer ? formatLakhs(currentBid.amount) : "—"}
        </motion.p>
      </AnimatePresence>

      {leadingFranchise ? (
        <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${leadingFranchise.colorFrom}, ${leadingFranchise.colorTo})`,
            }}
          >
            {initials(leadingFranchise.shortName)}
          </span>
          <span className="text-sm font-medium text-slate-200">{leadingFranchise.name}</span>
        </div>
      ) : (
        <span className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-slate-500 ring-1 ring-white/10">
          {currentPlayer ? "No bids yet" : "Waiting for next lot"}
        </span>
      )}

      {currentPlayer && (
        <p className="text-xs text-slate-500">
          Next bid:{" "}
          <span className="font-semibold text-slate-300">{formatLakhs(nextBidAmount)}</span>
        </p>
      )}
    </div>
  );
}