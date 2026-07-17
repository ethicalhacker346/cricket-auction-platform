import { motion } from "framer-motion";
import { Globe2, ShieldHalf } from "lucide-react";
import type { Player } from "@/features/auction/types/index.types";
import { ROLE_ICONS } from "@/features/auction/constants/index.constants";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { cn } from "@/utils/cn";

const TAG_STYLES: Record<string, string> = {
  marquee: "bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950",
  star: "bg-gradient-to-r from-indigo-400 to-sky-400 text-slate-950",
  uncapped: "bg-white/10 text-slate-300",
};

export function PlayerAuctionCard({
  player,
  compact = false,
}: {
  player: Player | null;
  compact?: boolean;
}) {
  if (!player) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-center">
        <ShieldHalf className="h-10 w-10 text-slate-700" />
        <p className="text-sm text-slate-500">No player under the hammer right now</p>
      </div>
    );
  }

  const stats = player.stats ?? { matches: 0, runs: 0, wickets: 0, average: 0, strikeRate: 0 };

  return (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.01] p-5"
    >
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-xl font-bold text-white ring-2 ring-white/10">
            {initials(player.name)}
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight text-white">{player.name}</h3>
            <p className="flex items-center gap-1 text-xs text-slate-400">
              {ROLE_ICONS[player.role]} {player.role}
              {player.overseas && (
                <span className="ml-1 inline-flex items-center gap-0.5 text-sky-400">
                  <Globe2 className="h-3 w-3" /> {player.country}
                </span>
              )}
            </p>
          </div>
        </div>
        {player.tag && (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
              TAG_STYLES[player.tag]
            )}
          >
            {player.tag}
          </span>
        )}
      </div>

      {!compact && (
        <div className="relative mt-5 grid grid-cols-4 gap-2 text-center">
          <Stat label="Matches" value={stats.matches} />
          <Stat
            label={player.role === "Batter" ? "Runs" : "Wkts"}
            value={player.role === "Batter" ? stats.runs : stats.wickets}
          />
          <Stat label="Avg" value={stats.average} />
          <Stat label="SR" value={stats.strikeRate} />
        </div>
      )}

      <div className="relative mt-5 flex items-center justify-between rounded-xl bg-black/20 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Base Price</p>
          <p className="text-base font-semibold text-slate-200">{formatLakhs(player.basePrice)}</p>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Age</p>
          <p className="text-base font-semibold text-slate-200">{player.age} yrs</p>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/[0.03] py-2">
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}