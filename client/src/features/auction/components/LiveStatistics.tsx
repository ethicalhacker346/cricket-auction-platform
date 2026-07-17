import { BarChart3, Coins, Gauge, Trophy, Users } from "lucide-react";
import { useLiveAuction } from "@/features/auction/hooks/index.hook";
import { formatLakhs } from "@/features/auction/utils/index.utils";

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{value}</p>
        <p className="truncate text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export function LiveStatistics() {
  const { players, playersSoldCount, playersUnsoldCount, totalMoneySpent } = useLiveAuction();
  const total = players.length;
  const remaining = total - playersSoldCount - playersUnsoldCount;
  const avgPrice = playersSoldCount > 0 ? totalMoneySpent / playersSoldCount : 0;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <StatTile
        icon={Trophy}
        label="Players Sold"
        value={`${playersSoldCount}`}
        accent="bg-emerald-500/15 text-emerald-300"
      />
      <StatTile
        icon={Users}
        label="Remaining"
        value={`${remaining}`}
        accent="bg-sky-500/15 text-sky-300"
      />
      <StatTile
        icon={Coins}
        label="Total Spent"
        value={formatLakhs(totalMoneySpent)}
        accent="bg-amber-500/15 text-amber-300"
      />
      <StatTile
        icon={Gauge}
        label="Avg. Price"
        value={formatLakhs(Math.round(avgPrice))}
        accent="bg-violet-500/15 text-violet-300"
      />
    </div>
  );
}

export function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-slate-200">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-sky-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AnalyticsHeaderIcon() {
  return <BarChart3 className="h-4 w-4" />;
}