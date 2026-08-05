import { useState } from "react";
import {
  BarChart3,
  Coins,
  Crown,
  Gauge,
  Globe2,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  CircleDot,
  Trophy,
  Users,
  Ban,
} from "lucide-react";
import { useLiveAuction } from "@/features/auction/hooks/index.hook";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import type { Franchise, Player, PlayerRole } from "@/features/auction/types/index.types";

// ============================================================================
// Shared visual identity primitives — franchise logos & player avatars.
// Every screen that lists players or franchises should render real imagery
// with a deterministic, on-brand fallback rather than a blank box.
// ============================================================================

/** Same seeded-hue derivation used server-side in mapFranchise(), kept in
 * sync here so a player without an uploaded photo still gets a stable,
 * good-looking gradient instead of a random one on every render. */
function seedGradient(seed: string): { from: string; to: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return { from: `hsl(${hue} 70% 50%)`, to: `hsl(${(hue + 55) % 360} 70% 40%)` };
}

const AVATAR_SIZES = {
  xs: "h-6 w-6 text-[8px]",
  sm: "h-8 w-8 text-[9px]",
  md: "h-10 w-10 text-[11px]",
  lg: "h-14 w-14 text-sm",
  xl: "h-20 w-20 text-lg",
} as const;

export function PlayerAvatar({
  player,
  size = "md",
  className = "",
}: {
  player: Pick<Player, "name" | "avatarSeed" | "profileImage">;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = !!player.profileImage && !broken;
  const { from, to } = seedGradient(player.avatarSeed || player.name || "player");

  if (showImage) {
    return (
      <img
        src={player.profileImage}
        alt={player.name}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full object-cover ring-1 ring-white/15 ${AVATAR_SIZES[size]} ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-1 ring-white/15 ${AVATAR_SIZES[size]} ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {initials(player.name || "?")}
    </span>
  );
}

const LOGO_SIZES = {
  xs: "h-6 w-6 text-[8px]",
  sm: "h-7 w-7 text-[9px]",
  md: "h-9 w-9 text-[10px]",
  lg: "h-12 w-12 text-xs",
} as const;

export function FranchiseLogo({
  franchise,
  size = "md",
  className = "",
}: {
  franchise: Pick<Franchise, "shortName" | "logo" | "colorFrom" | "colorTo">;
  size?: keyof typeof LOGO_SIZES;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = !!franchise.logo && !broken;

  if (showImage) {
    return (
      <img
        src={franchise.logo}
        alt={franchise.shortName}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full bg-white/5 object-contain ring-1 ring-white/15 ${LOGO_SIZES[size]} ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-1 ring-white/15 ${LOGO_SIZES[size]} ${className}`}
      style={{ background: `linear-gradient(135deg, ${franchise.colorFrom}, ${franchise.colorTo})` }}
    >
      {initials(franchise.shortName)}
    </span>
  );
}

// ============================================================================
// Role metadata — icon + accent per playing role, shared across the feature.
// ============================================================================
export const ROLE_META: Record<PlayerRole, { icon: React.ElementType; accent: string; dot: string }> = {
  Batter: { icon: Target, accent: "bg-sky-500/15 text-sky-300", dot: "bg-sky-400" },
  Bowler: { icon: CircleDot, accent: "bg-rose-500/15 text-rose-300", dot: "bg-rose-400" },
  "All-Rounder": { icon: Sparkles, accent: "bg-amber-500/15 text-amber-300", dot: "bg-amber-400" },
  "Wicket-Keeper": { icon: ShieldCheck, accent: "bg-emerald-500/15 text-emerald-300", dot: "bg-emerald-400" },
};

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{value}</p>
        <p className="truncate text-[10px] uppercase tracking-wider text-slate-500">
          {label}
          {sub && <span className="ml-1 normal-case tracking-normal text-slate-600">· {sub}</span>}
        </p>
      </div>
    </div>
  );
}

export function LiveStatistics() {
  const {
    players,
    franchises,
    playersSoldCount,
    playersUnsoldCount,
    playersPermanentUnsoldCount,
    totalMoneySpent,
    viewerCount,
  } = useLiveAuction();

  const total = players.length;
  const permanentUnsold = playersPermanentUnsoldCount ?? 0;

  // Correction: permanent unsold players are fully settled (removed from the pool),
  // so they must be subtracted from remaining alongside sold and unsold.
  const remaining = total - (playersSoldCount ?? 0) - (playersUnsoldCount ?? 0) - permanentUnsold;

  const avgPrice = playersSoldCount && playersSoldCount > 0 ? totalMoneySpent / playersSoldCount : 0;

  const topSale = players
    .filter((p) => p.status === "sold")
    .reduce<Player | null>((best, p) => ((p.soldPrice ?? 0) > (best?.soldPrice ?? 0) ? p : best), null);

  const topSpenders = [...franchises]
    .filter((f) => f.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 4);

  return (
    <div className="space-y-3">
      {/* 
        Responsive grid: 7 tiles now.
        Mobile: 2 cols | SM: 3 cols | LG: 4 cols | XL: 7 cols (single row on wide screens)
      */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatTile
          icon={Trophy}
          label="Players Sold"
          value={`${playersSoldCount ?? 0}`}
          sub={total ? `of ${total}` : undefined}
          accent="bg-emerald-500/15 text-emerald-300"
        />
        <StatTile
          icon={Users}
          label="Remaining"
          value={`${Math.max(remaining, 0)}`}
          sub={`${playersUnsoldCount ?? 0} unsold`}
          accent="bg-sky-500/15 text-sky-300"
        />
        <StatTile
          icon={Ban}
          label="Perm. Unsold"
          value={`${permanentUnsold}`}
          sub={permanentUnsold > 0 ? "removed from pool" : undefined}
          accent="bg-slate-500/15 text-slate-300"
        />
        <StatTile
          icon={Coins}
          label="Total Spent"
          value={formatLakhs(totalMoneySpent ?? 0)}
          accent="bg-amber-500/15 text-amber-300"
        />
        <StatTile
          icon={Gauge}
          label="Avg. Price"
          value={formatLakhs(Math.round(avgPrice))}
          accent="bg-violet-500/15 text-violet-300"
        />
        <StatTile
          icon={Crown}
          label="Top Sale"
          value={topSale ? formatLakhs(topSale.soldPrice ?? 0) : "—"}
          sub={topSale?.name}
          accent="bg-rose-500/15 text-rose-300"
        />
        <StatTile
          icon={Radio}
          label="Watching"
          value={`${viewerCount ?? 0}`}
          accent="bg-cyan-500/15 text-cyan-300"
        />
      </div>

      {topSpenders.length > 0 && (
        <div className="flex items-center gap-3 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Top Spenders
          </span>
          <div className="flex flex-1 items-center gap-4">
            {topSpenders.map((f, i) => (
              <div key={f.id} className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] font-bold text-slate-600">#{i + 1}</span>
                <FranchiseLogo franchise={f} size="xs" />
                <span className="text-xs font-medium text-slate-300">{f.shortName}</span>
                <span className="text-xs font-bold text-amber-300">{formatLakhs(f.spent)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StatBar({
  label,
  value,
  max,
  icon: Icon,
  barClassName,
  sub,
}: {
  label: string;
  value: number;
  max: number;
  icon?: React.ElementType;
  barClassName?: string;
  sub?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-400">
          {Icon && <Icon className="h-3 w-3" />}
          {label}
        </span>
        <span className="font-semibold text-slate-200">
          {value}
          {sub && <span className="ml-1 font-normal text-slate-500">{sub}</span>}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barClassName ?? "from-indigo-400 to-sky-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AnalyticsHeaderIcon() {
  return <BarChart3 className="h-4 w-4" />;
}