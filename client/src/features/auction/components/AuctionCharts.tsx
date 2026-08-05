import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
} from "recharts";
import { formatLakhs } from "@/features/auction/utils/index.utils";
import type { Player, Franchise, PlayerRole, Bid } from "@/features/auction/types/index.types";
import { ROLE_META } from "@/features/auction/components/LiveStatistics";

// ============================================================================
// Design Tokens — consistent with the app's dark aesthetic
// ============================================================================
const CHART_COLORS = {
  emerald: "#34d399",
  emeraldSoft: "rgba(52, 211, 153, 0.15)",
  rose: "#fb7185",
  roseSoft: "rgba(251, 113, 133, 0.15)",
  amber: "#fbbf24",
  amberSoft: "rgba(251, 191, 36, 0.15)",
  sky: "#38bdf8",
  skySoft: "rgba(56, 189, 248, 0.15)",
  violet: "#a78bfa",
  violetSoft: "rgba(167, 139, 250, 0.15)",
  slate: "#94a3b8",
  slateSoft: "rgba(148, 163, 184, 0.15)",
  orange: "#fb923c",
  cyan: "#22d3ee",
  fuchsia: "#e879f9",
  indigo: "#818cf8",
};

const STATUS_COLORS = {
  sold: CHART_COLORS.emerald,
  unsold: CHART_COLORS.rose,
  permanent_unsold: CHART_COLORS.slate,
  pending: CHART_COLORS.amber,
};

const ROLE_COLORS: Record<PlayerRole, string> = {
  Batter: "#38bdf8",
  Bowler: "#fb7185",
  "All-Rounder": "#fbbf24",
  "Wicket-Keeper": "#34d399",
};

// ============================================================================
// Shared primitives
// ============================================================================
function ChartCard({
  title,
  subtitle,
  children,
  className = "",
  height = 280,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${className}`}>
      <div className="mb-1">
        <p className="text-sm font-semibold text-slate-200">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      {label && <p className="mb-1 text-[11px] font-semibold text-slate-300">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-[11px]">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-400">{entry.name}:</span>
          <span className="font-semibold text-white">
            {typeof entry.value === "number" && entry.value > 999
              ? formatLakhs(entry.value)
              : entry.value}
            {entry.unit && <span className="ml-0.5 text-slate-500">{entry.unit}</span>}
          </span>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// 1. STATUS DISTRIBUTION — Donut Chart
// ============================================================================
export function StatusDistributionChart({
  players,
  playersSoldCount,
  playersUnsoldCount,
  playersPermanentUnsoldCount,
}: {
  players: Player[];
  playersSoldCount: number;
  playersUnsoldCount: number;
  playersPermanentUnsoldCount: number;
}) {
  const data = useMemo(() => {
    const pending = players.length - playersSoldCount - playersUnsoldCount - playersPermanentUnsoldCount;
    return [
      { name: "Sold", value: playersSoldCount, color: STATUS_COLORS.sold },
      { name: "Unsold", value: playersUnsoldCount, color: STATUS_COLORS.unsold },
      { name: "Perm. Unsold", value: playersPermanentUnsoldCount, color: STATUS_COLORS.permanent_unsold },
      { name: "Pending", value: Math.max(pending, 0), color: STATUS_COLORS.pending },
    ].filter((d) => d.value > 0);
  }, [players, playersSoldCount, playersUnsoldCount, playersPermanentUnsoldCount]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ChartCard title="Auction Settlement" subtitle="Player status breakdown" height={260}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={85}
            paddingAngle={4}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            iconSize={8}
            formatter={(value: string, entry: any) => (
              <span className="text-[11px] text-slate-400">
                {value} ·{" "}
                <span className="font-semibold text-slate-200">
                  {entry.payload?.value ?? 0}
                </span>
              </span>
            )}
          />
          {/* Center label */}
          <text x="50%" y="45%" textAnchor="middle" dominantBaseline="central" className="fill-white">
            <tspan className="text-2xl font-black" style={{ fontSize: 22, fontWeight: 800 }}>
              {total}
            </tspan>
          </text>
          <text x="50%" y="58%" textAnchor="middle" dominantBaseline="central" className="fill-slate-500">
            <tspan style={{ fontSize: 10 }}>Players</tspan>
          </text>
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================================================
// 2. ROLE DISTRIBUTION — Pie Chart
// ============================================================================
export function RoleDistributionChart({ soldPlayers }: { soldPlayers: Player[] }) {
  const data = useMemo(() => {
    const roles: PlayerRole[] = ["Batter", "Bowler", "All-Rounder", "Wicket-Keeper"];
    return roles
      .map((role) => ({
        name: role,
        value: soldPlayers.filter((p) => p.role === role).length,
        color: ROLE_COLORS[role],
      }))
      .filter((d) => d.value > 0);
  }, [soldPlayers]);

  return (
    <ChartCard title="Sold by Role" subtitle="Squad composition across franchises" height={260}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
            label={({ name, percent }) =>
              percent > 0.08 ? `${name}` : ""
            }
            labelLine={false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            iconSize={8}
            formatter={(value: string, entry: any) => (
              <span className="text-[11px] text-slate-400">
                {value} ·{" "}
                <span className="font-semibold text-slate-200">{entry.payload?.value ?? 0}</span>
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================================================
// 3. OVERSEAS vs DOMESTIC — Semi-circle Gauge
// ============================================================================
export function OverseasDomesticChart({ soldPlayers }: { soldPlayers: Player[] }) {
  const data = useMemo(() => {
    const overseas = soldPlayers.filter((p) => p.overseas).length;
    const domestic = soldPlayers.length - overseas;
    return [
      { name: "Domestic", value: domestic, color: CHART_COLORS.sky },
      { name: "Overseas", value: overseas, color: CHART_COLORS.violet },
    ];
  }, [soldPlayers]);

  return (
    <ChartCard title="Domestic vs Overseas" subtitle="Sold player origin split" height={260}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={90}
            paddingAngle={4}
            dataKey="value"
            stroke="none"
            label={({ name, value, percent }) =>
              `${name}: ${value} (${Math.round((percent || 0) * 100)}%)`
            }
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================================================
// 4. FRANCHISE SPENDING — Horizontal Bar Chart
// ============================================================================
export function FranchiseSpendingChart({ franchises }: { franchises: Franchise[] }) {
  const data = useMemo(() => {
    return [...franchises]
      .sort((a, b) => b.spent - a.spent)
      .map((f) => ({
        name: f.shortName || f.name,
        spent: f.spent,
        remaining: Math.max(f.purseTotal - f.spent - (f.reservedBudget || 0), 0),
        purse: f.purseTotal,
        color: f.colorFrom,
      }));
  }, [franchises]);

  return (
    <ChartCard title="Franchise Spending" subtitle="Purse utilization comparison" height={320}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickFormatter={(v) => formatLakhs(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="spent" name="Spent" stackId="a" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color || CHART_COLORS.emerald} />
            ))}
          </Bar>
          <Bar dataKey="remaining" name="Remaining" stackId="a" fill={CHART_COLORS.slateSoft} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================================================
// 5. TOP BUYS — Horizontal Bar Chart
// ============================================================================
export function TopBuysChart({ soldPlayers }: { soldPlayers: Player[] }) {
  const data = useMemo(() => {
    return [...soldPlayers]
      .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
      .slice(0, 10)
      .map((p) => ({
        name: p.name,
        price: p.soldPrice ?? 0,
        role: p.role,
        color: ROLE_COLORS[p.role],
      }));
  }, [soldPlayers]);

  return (
    <ChartCard title="Top 10 Buys" subtitle="Highest sold prices" height={340}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickFormatter={(v) => formatLakhs(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="price" name="Sold Price" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={1 - i * 0.06} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================================================
// 6. ROLE-WISE AVERAGE PRICE — Vertical Bar Chart
// ============================================================================
export function RolePriceChart({ soldPlayers }: { soldPlayers: Player[] }) {
  const data = useMemo(() => {
    const roles: PlayerRole[] = ["Batter", "Bowler", "All-Rounder", "Wicket-Keeper"];
    return roles.map((role) => {
      const rolePlayers = soldPlayers.filter((p) => p.role === role);
      const avg =
        rolePlayers.length > 0
          ? rolePlayers.reduce((s, p) => s + (p.soldPrice ?? 0), 0) / rolePlayers.length
          : 0;
      return {
        name: role,
        avg: Math.round(avg),
        count: rolePlayers.length,
        color: ROLE_COLORS[role],
      };
    });
  }, [soldPlayers]);

  return (
    <ChartCard title="Avg. Price by Role" subtitle="Market value per playing position" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickFormatter={(v) => formatLakhs(v)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="avg" name="Avg Price" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================================================
// 7. BIDDING ACTIVITY TIMELINE — Area Chart
// ============================================================================
export function BiddingActivityChart({ bidHistory }: { bidHistory: Bid[] }) {
  const data = useMemo(() => {
    if (bidHistory.length === 0) return [];
    const sorted = [...bidHistory].sort((a, b) => a.timestamp - b.timestamp);
    const buckets = new Map<string, { time: string; bids: number; volume: number }>();

    // Bucket into 5-minute windows
    sorted.forEach((bid) => {
      const date = new Date(bid.timestamp);
      const key = `${date.getHours().toString().padStart(2, "0")}:${Math.floor(date.getMinutes() / 5) * 5
        .toString()
        .padStart(2, "0")}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.bids += 1;
        existing.volume += bid.amount;
      } else {
        buckets.set(key, { time: key, bids: 1, volume: bid.amount });
      }
    });

    return Array.from(buckets.values()).slice(-20);
  }, [bidHistory]);

  if (data.length === 0) {
    return (
      <ChartCard title="Bidding Activity" subtitle="Bid frequency over time" height={280}>
        <div className="flex h-full items-center justify-center">
          <p className="text-xs text-slate-600">No bidding data yet</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Bidding Activity" subtitle="Bid frequency & volume over time" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bidGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.amber} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
          <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="bids"
            name="Bids"
            stroke={CHART_COLORS.amber}
            strokeWidth={2}
            fill="url(#bidGradient)"
          />
          <Line
            type="monotone"
            dataKey="volume"
            name="Volume"
            stroke={CHART_COLORS.rose}
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 4"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================================================
// 8. PRICE DISTRIBUTION — Scatter Chart
// ============================================================================
export function PriceDistributionChart({ soldPlayers }: { soldPlayers: Player[] }) {
  const data = useMemo(() => {
    return soldPlayers.map((p, i) => ({
      x: i + 1,
      y: p.soldPrice ?? 0,
      name: p.name,
      role: p.role,
      z: 100,
    }));
  }, [soldPlayers]);

  if (data.length === 0) {
    return (
      <ChartCard title="Price Distribution" subtitle="Sold price spread across all players" height={280}>
        <div className="flex h-full items-center justify-center">
          <p className="text-xs text-slate-600">No sales recorded yet</p>
        </div>
      </ChartCard>
    );
  }

  const avgPrice = data.length > 0 ? data.reduce((s, d) => s + d.y, 0) / data.length : 0;

  return (
    <ChartCard title="Price Distribution" subtitle="Sold price spread with average line" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            type="number"
            dataKey="x"
            name="Player"
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            label={{ value: "Player Index", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 10 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Price"
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickFormatter={(v) => formatLakhs(v)}
          />
          <ZAxis type="number" dataKey="z" range={[60, 120]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.2)" }}
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur-sm">
                  <p className="text-[11px] font-semibold text-slate-200">{p.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {p.role} · {formatLakhs(p.y)}
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine
            y={avgPrice}
            stroke={CHART_COLORS.amber}
            strokeDasharray="6 4"
            label={{
              value: `Avg: ${formatLakhs(Math.round(avgPrice))}`,
              position: "insideTopRight",
              fill: CHART_COLORS.amber,
              fontSize: 10,
            }}
          />
          <Scatter
            name="Sold Price"
            data={data}
            fill={CHART_COLORS.emerald}
            fillOpacity={0.7}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================================================
// 9. FRANCHISE SQUAD BALANCE — Radar Chart
// ============================================================================
export function FranchiseBalanceChart({
  franchises,
  players,
}: {
  franchises: Franchise[];
  players: Player[];
}) {
  const data = useMemo(() => {
    const roles: PlayerRole[] = ["Batter", "Bowler", "All-Rounder", "Wicket-Keeper"];
    const topFranchises = [...franchises]
      .filter((f) => f.squad.length > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 4);

    if (topFranchises.length === 0) return [];

    return roles.map((role) => {
      const entry: Record<string, any> = { role };
      topFranchises.forEach((f) => {
        const count = players.filter((p) => p.teamId === f.id && p.role === role).length;
        entry[f.shortName || f.name] = count;
      });
      return entry;
    });
  }, [franchises, players]);

  const franchisesList = useMemo(() => {
    return [...franchises]
      .filter((f) => f.squad.length > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 4);
  }, [franchises]);

  const colors = [CHART_COLORS.emerald, CHART_COLORS.sky, CHART_COLORS.rose, CHART_COLORS.violet];

  if (data.length === 0) {
    return (
      <ChartCard title="Squad Balance" subtitle="Role distribution by franchise" height={300}>
        <div className="flex h-full items-center justify-center">
          <p className="text-xs text-slate-600">No squad data yet</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Squad Balance" subtitle="Role distribution by top franchises" height={300}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis dataKey="role" tick={{ fill: "#94a3b8", fontSize: 10 }} />
          <PolarRadiusAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} />
          {franchisesList.map((f, i) => (
            <Radar
              key={f.id}
              name={f.shortName || f.name}
              dataKey={f.shortName || f.name}
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => <span className="text-[11px] text-slate-400">{value}</span>}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================================================
// 10. CATEGORY BREAKDOWN — Vertical Bar Chart
// ============================================================================
export function CategoryBreakdownChart({ soldPlayers }: { soldPlayers: Player[] }) {
  const data = useMemo(() => {
    const categories = [
      { key: "marquee", label: "Marquee", color: CHART_COLORS.amber },
      { key: "star", label: "Star", color: CHART_COLORS.fuchsia },
      { key: "uncapped", label: "Uncapped", color: CHART_COLORS.sky },
      { key: "other", label: "Unclassified", color: CHART_COLORS.slate },
    ];
    return categories.map((cat) => ({
      name: cat.label,
      count: soldPlayers.filter((p) => (cat.key === "other" ? !p.tag : p.tag === cat.key)).length,
      color: cat.color,
    }));
  }, [soldPlayers]);

  return (
    <ChartCard title="Category Breakdown" subtitle="Sold players by tag" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name="Players" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================================================
// 11. MOST CONTESTED LOTS — Horizontal Bar Chart
// ============================================================================
export function MostContestedChart({
  bidHistory,
  players,
}: {
  bidHistory: Bid[];
  players: Player[];
}) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    bidHistory.forEach((b) => counts.set(b.playerId, (counts.get(b.playerId) ?? 0) + 1));
    return Array.from(counts.entries())
      .map(([playerId, count]) => {
        const player = players.find((p) => p.id === playerId);
        return {
          name: player?.name || "Unknown",
          bids: count,
          color: player ? ROLE_COLORS[player.role] : CHART_COLORS.slate,
        };
      })
      .filter((d) => d.bids > 1)
      .sort((a, b) => b.bids - a.bids)
      .slice(0, 8);
  }, [bidHistory, players]);

  if (data.length === 0) {
    return (
      <ChartCard title="Most Contested" subtitle="Lots with highest bid counts" height={280}>
        <div className="flex h-full items-center justify-center">
          <p className="text-xs text-slate-600">No contested lots yet</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Most Contested Lots" subtitle="Players that drew the most bids" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="bids" name="Bid Count" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={1 - i * 0.08} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ============================================================================
// 12. SPENDING TREND — Line Chart (cumulative over time)
// ============================================================================
export function SpendingTrendChart({
  bidHistory,
}: {
  bidHistory: Bid[];
}) {
  const data = useMemo(() => {
    if (bidHistory.length === 0) return [];
    const sorted = [...bidHistory].sort((a, b) => a.timestamp - b.timestamp);
    let cumulative = 0;
    return sorted.map((bid) => {
      cumulative += bid.amount;
      const date = new Date(bid.timestamp);
      return {
        time: `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`,
        cumulative,
      };
    });
  }, [bidHistory]);

  if (data.length === 0) {
    return (
      <ChartCard title="Spending Trend" subtitle="Cumulative money spent over time" height={280}>
        <div className="flex h-full items-center justify-center">
          <p className="text-xs text-slate-600">No data yet</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Spending Trend" subtitle="Cumulative money spent over time" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickFormatter={(v) => formatLakhs(v)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="cumulative"
            name="Total Spent"
            stroke={CHART_COLORS.emerald}
            strokeWidth={2}
            fill="url(#spendGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}