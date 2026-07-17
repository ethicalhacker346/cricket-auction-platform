import { AnimatePresence, motion } from "framer-motion";
import { useLiveAuction } from "@/features/auction/hooks/index.hook";
import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";

export function SoldUnsoldAnimation() {
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);

  const { soldEvent, unsoldEvent, franchises, players } = useLiveAuction(
    storeAuctionId || undefined,
    storeTournamentId || undefined
  );

  const soldPlayer = soldEvent ? players.find((p) => p.id === soldEvent.playerId) : null;
  const soldFranchise = soldEvent ? franchises.find((f) => f.id === soldEvent.teamId) : null;
  const unsoldPlayer = unsoldEvent ? players.find((p) => p.id === unsoldEvent.playerId) : null;

  return (
    <AnimatePresence>
      {soldEvent && soldPlayer && (
        <motion.div
          key={`sold-${soldEvent.seq}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 14 }}
            className="flex flex-col items-center gap-3 rounded-3xl border border-amber-400/30 bg-gradient-to-b from-slate-900 to-slate-950 px-10 py-8 text-center shadow-2xl shadow-amber-500/20"
          >
            <span className="text-6xl">🔨</span>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-400">Sold!</p>
            <p className="text-2xl font-black text-white">{soldPlayer.name}</p>
            {soldFranchise && (
              <div className="flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${soldFranchise.colorFrom}, ${soldFranchise.colorTo})`,
                  }}
                >
                  {initials(soldFranchise.shortName)}
                </span>
                <span className="text-base font-semibold text-slate-200">{soldFranchise.name}</span>
              </div>
            )}
            <p className="text-3xl font-black text-emerald-400">{formatLakhs(soldEvent.amount)}</p>
          </motion.div>
        </motion.div>
      )}

      {unsoldEvent && unsoldPlayer && (
        <motion.div
          key={`unsold-${unsoldEvent.seq}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 14 }}
            className="flex flex-col items-center gap-3 rounded-3xl border border-rose-500/30 bg-gradient-to-b from-slate-900 to-slate-950 px-10 py-8 text-center shadow-2xl shadow-rose-500/10"
          >
            <span className="text-6xl">🚫</span>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-rose-400">Unsold</p>
            <p className="text-2xl font-black text-white">{unsoldPlayer.name}</p>
            <p className="text-sm text-slate-400">Goes back to the pool</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}