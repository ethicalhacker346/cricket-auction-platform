import { useState, useEffect } from "react";
import { ListOrdered, Users, Globe2, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useLiveAuction } from "@/features/auction/hooks/index.hook";
import { ROLE_ICONS } from "@/features/auction/constants/index.constants";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { RoundStatusBadge } from "./Badges";
import { cn } from "@/utils/cn";

/* ─── Helpers ─── */
function seedHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function GradientAvatar({ player, size = "md" }: { player: { avatarSeed: string; id: string; name: string; profileImage?: string }; size?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [player.profileImage]);
  const showImage = Boolean(player.profileImage) && !failed;
  const hue = seedHue(player.avatarSeed || player.id || player.name);
  const dims = size === "lg" ? "h-12 w-12 text-sm" : size === "md" ? "h-10 w-10 text-xs" : "h-8 w-8 text-[10px]";

  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl", dims)}>
      {showImage ? (
        <img src={player.profileImage} alt={player.name} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-bold text-white"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 55) % 360} 70% 40%))` }}
        >
          {initials(player.name)}
        </div>
      )}
    </div>
  );
}

function TagBadge({ tag, compact = false }: { tag: string; compact?: boolean }) {
  const styles: Record<string, string> = {
    marquee: "bg-amber-400/15 text-amber-300 border-amber-400/20",
    star: "bg-sky-400/15 text-sky-300 border-sky-400/20",
    uncapped: "bg-slate-400/10 text-slate-400 border-white/10",
  };
  return (
    <span
      className={cn(
        "rounded-full border font-bold uppercase tracking-wider",
        styles[tag] || styles.uncapped,
        compact ? "px-1 py-0 text-[8px]" : "px-1.5 py-0.5 text-[9px]"
      )}
    >
      {tag}
    </span>
  );
}

function StyleChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-white/5 px-1 py-0.5 text-[9px] text-slate-400 border border-white/5">
      {children}
    </span>
  );
}

const ROUND_TYPE_STYLES: Record<string, { gradient: string; text: string }> = {
  marquee: { gradient: "from-amber-400 to-rose-500", text: "text-slate-950" },
  capped: { gradient: "from-indigo-400 to-sky-400", text: "text-slate-950" },
  uncapped: { gradient: "from-slate-400 to-slate-500", text: "text-white" },
  overseas: { gradient: "from-sky-400 to-cyan-400", text: "text-slate-950" },
  accelerated: { gradient: "from-emerald-400 to-teal-400", text: "text-slate-950" },
};

function RoundTypeBadge({ type }: { type: string }) {
  const style = ROUND_TYPE_STYLES[type] || ROUND_TYPE_STYLES.uncapped;
  return (
    <span className={cn("rounded-full bg-gradient-to-r px-2 py-0.5 text-[9px] font-bold", style.gradient, style.text)}>
      {type}
    </span>
  );
}

/* ─── PlayerQueue ─── */
export function PlayerQueue() {
  const { upcomingPlayers, currentPlayer, status } = useLiveAuction();
  const isLive = status === "live";
  const hasQueue = upcomingPlayers.length > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <Users className="h-3.5 w-3.5" /> Up Next
        </p>
        {isLive && currentPlayer && (
          <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-medium text-amber-300">
            Live
          </span>
        )}
      </div>

      <div className="space-y-2">
        {!hasQueue && !currentPlayer && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Users className="h-6 w-6 text-slate-700" />
            <p className="text-xs text-slate-500">No players queued</p>
            <p className="text-[10px] text-slate-600">Auction may be paused or completed</p>
          </div>
        )}

        {!hasQueue && currentPlayer && (
          <p className="py-4 text-center text-xs text-slate-500">
            Last player on the block — queue empty after this lot
          </p>
        )}

        {upcomingPlayers.map((p, i) => {
          const isMarquee = p.tag === "marquee";
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                isMarquee
                  ? "border-amber-400/10 bg-amber-400/[0.02] hover:bg-amber-400/[0.04]"
                  : "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  isMarquee ? "bg-amber-400/20 text-amber-300" : "bg-white/5 text-slate-400"
                )}
              >
                {i + 1}
              </span>

              <GradientAvatar player={p} size="md" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-200">{p.name}</p>
                  {p.tag && <TagBadge tag={p.tag} compact />}
                  {p.overseas && <Globe2 className="h-3 w-3 shrink-0 text-sky-400" title={p.country} />}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-slate-400">
                    {ROLE_ICONS[p.role as keyof typeof ROLE_ICONS] ?? "🏏"} {p.role}
                  </span>
                  {p.battingStyle && <StyleChip>{p.battingStyle}</StyleChip>}
                  {p.bowlingStyle && <StyleChip>{p.bowlingStyle}</StyleChip>}
                  {p.age > 0 && <StyleChip>{p.age}y</StyleChip>}
                </div>
              </div>

              <span className="shrink-0 text-xs font-bold text-slate-300">{formatLakhs(p.basePrice)}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── RoundProgress ─── */
export function RoundProgress() {
  const { rounds, currentRoundId, players } = useLiveAuction();
  const sorted = [...rounds].sort((a, b) => a.order - b.order);
  const completedCount = sorted.filter((r) => r.status === "completed").length;
  const totalCount = sorted.length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <ListOrdered className="h-3.5 w-3.5" /> Round Progress
        </p>
        {totalCount > 0 && (
          <span className="text-[10px] text-slate-500">
            {completedCount}/{totalCount} done
          </span>
        )}
      </div>

      {totalCount > 0 && (
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      )}

      <div className="space-y-2">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <ListOrdered className="h-5 w-5 text-slate-700" />
            <p className="text-xs text-slate-500">No rounds configured</p>
          </div>
        )}

        {sorted.map((r) => {
          const isCurrent = r.id === currentRoundId;
          const isCompleted = r.status === "completed";
          const isActive = r.status === "active";

          const roundPlayers = players.filter((p) => r.playerIds.includes(p.id));
          const soldCount = roundPlayers.filter((p) => p.status === "sold").length;
          const unsoldCount = roundPlayers.filter((p) => p.status === "unsold").length;
          const pendingCount = roundPlayers.filter((p) => p.status === "pending").length;
          const totalInRound = r.playerIds.length;

          const soldPct = totalInRound > 0 ? (soldCount / totalInRound) * 100 : 0;
          const unsoldPct = totalInRound > 0 ? (unsoldCount / totalInRound) * 100 : 0;
          const pendingPct = totalInRound > 0 ? (pendingCount / totalInRound) * 100 : 0;

          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "relative overflow-hidden rounded-xl border p-3 transition",
                isCurrent
                  ? "border-amber-400/30 bg-amber-400/[0.05] shadow-lg shadow-amber-400/5"
                  : isActive
                  ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                  : isCompleted
                  ? "border-white/5 bg-white/[0.02] opacity-70"
                  : "border-white/5 bg-white/[0.02]"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      isCurrent
                        ? "bg-amber-400/20 text-amber-300"
                        : isCompleted
                        ? "bg-emerald-500/20 text-emerald-400"
                        : isActive
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-white/5 text-slate-500"
                    )}
                  >
                    {isCompleted ? "✓" : r.order}
                  </span>
                  <span
                    className={cn(
                      "truncate text-sm font-bold",
                      isCurrent ? "text-amber-300" : isActive ? "text-emerald-300" : "text-slate-300"
                    )}
                  >
                    {r.name}
                  </span>
                  {r.type && r.type !== "normal" && <RoundTypeBadge type={r.type} />}
                </div>
                <RoundStatusBadge status={r.status} />
              </div>

              {totalInRound > 0 && (
                <div className="mb-1.5 flex h-1.5 w-full gap-px overflow-hidden rounded-full">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${soldPct}%` }}
                  />
                  <div
                    className="h-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${unsoldPct}%` }}
                  />
                  <div
                    className="h-full bg-white/10 transition-all duration-500"
                    style={{ width: `${pendingPct}%` }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-[9px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-2.5 w-2.5" />
                  {totalInRound} players
                </span>
                <span className="inline-flex items-center gap-2">
                  {soldCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-emerald-400">
                      <TrendingUp className="h-2.5 w-2.5" /> {soldCount}
                    </span>
                  )}
                  {unsoldCount > 0 && <span className="text-rose-400">{unsoldCount} unsold</span>}
                  {pendingCount > 0 && <span className="text-slate-400">{pendingCount} pending</span>}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}