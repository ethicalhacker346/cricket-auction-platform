import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { useLiveAuction } from "@/features/auction/hooks/index.hook";
import { useRoleStore } from "@/features/auction/store/index.store";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { cn } from "@/utils/cn";

export function FranchisePanel() {
  const { franchises, currentBid } = useLiveAuction();
  const userTeamId = useRoleStore((s) => s.userTeamId);

  if (franchises.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <Wallet className="h-3.5 w-3.5" /> Franchises
        </p>
        <p className="py-6 text-center text-xs text-slate-600">Loading franchise data…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
        <Wallet className="h-3.5 w-3.5" /> Franchises
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {franchises.map((f) => {
          // reservedBudget covers this franchise's own currently-leading
          // bid (see TournamentTeam wallet invariant) — it's locked, not
          // spent, so it still has to come off what shows as "remaining".
          const remaining = f.purseTotal - f.spent - f.reservedBudget;
          const isLeading = currentBid?.teamId === f.id;
          const isUser = f.id === userTeamId;
          const pct = f.purseTotal > 0 ? Math.round((remaining / f.purseTotal) * 100) : 0;

          return (
            <motion.div
              key={f.id}
              animate={isLeading ? { scale: [1, 1.04, 1] } : {}}
              transition={{ duration: 0.5, repeat: isLeading ? Infinity : 0, repeatDelay: 0.6 }}
              className={cn(
                "relative rounded-xl border p-3 transition",
                isLeading
                  ? "border-amber-400/60 bg-amber-400/10 shadow-lg shadow-amber-500/10"
                  : "border-white/10 bg-white/[0.02]"
              )}
            >
              {isUser && (
                <span className="absolute -top-2 right-2 rounded-full bg-sky-500 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">
                  You
                </span>
              )}
              <div className="flex items-center gap-2">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${f.colorFrom}, ${f.colorTo})` }}
                >
                  {initials(f.shortName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">{f.shortName}</p>
                  <p className="truncate text-[10px] text-slate-500">
                    {f.squad?.length ?? 0}/{f.maxSquadSize} squad
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      pct > 40 ? "bg-emerald-400" : pct > 15 ? "bg-amber-400" : "bg-rose-500"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-medium text-slate-400">
                  {formatLakhs(remaining)} left
                  {f.reservedBudget > 0 && (
                    <span className="text-slate-600"> · {formatLakhs(f.reservedBudget)} reserved</span>
                  )}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}