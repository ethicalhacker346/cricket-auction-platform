import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion } from "framer-motion";
import { useLiveAuction } from "@/features/auction/hooks/index.hook";
import type { Franchise, Player } from "@/features/auction/types/index.types";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { Globe2, Gavel, XCircle, TrendingUp } from "lucide-react";
import { cn } from "@/utils/cn";

/* ─── Constants ─── */
const CONFETTI_COLORS = ["#fbbf24", "#f59e0b", "#34d399", "#38bdf8", "#f472b6", "#a78bfa", "#fb7185"];
const SOLD_DURATION_MS = 3600;
const UNSOLD_DURATION_MS = 2400;

/* ─── Deterministic Hue (same algorithm as PlayerAuctionCard) ─── */
function seedHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

/* ─── useDismissingEvent (unchanged logic — the fix that stopped the freeze) ─── */
function useDismissingEvent<T extends { seq: number }>(event: T | null | undefined, durationMs: number) {
  const [active, setActive] = useState<T | null>(null);
  const lastSeenSeq = useRef<number | null>(event?.seq ?? null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!event || event.seq === lastSeenSeq.current) return;
    lastSeenSeq.current = event.seq;
    setActive(event);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setActive(null), durationMs);
    return () => clearTimeout(hideTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.seq]);

  const dismiss = () => {
    clearTimeout(hideTimer.current);
    setActive(null);
  };

  return { active, dismiss };
}

/* ─── DismissTimer (unchanged) ─── */
function DismissTimer({ durationMs, colorClass }: { durationMs: number; colorClass: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-3xl bg-white/5">
      <motion.div
        className={`h-full ${colorClass}`}
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: durationMs / 1000, ease: "linear" }}
      />
    </div>
  );
}

/* ─── useImageFallback (unchanged) ─── */
function useImageFallback(src?: string) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return { showImage: Boolean(src) && !failed, onError: () => setFailed(true) };
}

/* ─── CelebrationAvatar ─── */
function CelebrationAvatar({ player, size = "lg" }: { player: Player; size?: "md" | "lg" | "xl" }) {
  const { showImage, onError } = useImageFallback(player.profileImage);
  const hue = seedHue(player.avatarSeed || player.id || player.name);
  const dims = size === "xl" ? "h-28 w-28 text-3xl" : size === "lg" ? "h-20 w-20 text-2xl" : "h-14 w-14 text-lg";

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", dims)}>
      {showImage ? (
        <img src={player.profileImage} alt={player.name} onError={onError} className="h-full w-full object-cover" />
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

/* ─── FranchiseBadge ─── */
function FranchiseBadge({ franchise, size = "md" }: { franchise: Franchise; size?: "sm" | "md" | "lg" }) {
  const { showImage, onError } = useImageFallback(franchise.logo);
  const dims = size === "lg" ? "h-16 w-16 text-xl" : size === "md" ? "h-10 w-10 text-sm" : "h-6 w-6 text-[10px]";

  return (
    <span className={cn("relative flex shrink-0 overflow-hidden rounded-full ring-2 ring-white/10 shadow-lg", dims)}>
      {showImage ? (
        <img src={franchise.logo} alt={franchise.name} onError={onError} className="h-full w-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${franchise.colorFrom}, ${franchise.colorTo})` }}
        >
          {initials(franchise.shortName)}
        </span>
      )}
    </span>
  );
}

/* ─── AnimatedAmount (unchanged) ─── */
function AnimatedAmount({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    setDisplay(0);
    const controls = animate(0, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [value]);
  return <>{formatLakhs(display)}</>;
}

/* ─── TagBadge ─── */
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

/* ─── StyleChip ─── */
function StyleChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-400 border border-white/5">
      {children}
    </span>
  );
}

/* ─── PlayerDetailsStrip ─── */
function PlayerDetailsStrip({ player }: { player: Player }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {player.tag && <TagBadge tag={player.tag} />}
        <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-300 border border-white/5">
          {player.role}
        </span>
        {player.overseas && (
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-400/10 px-1.5 py-0.5 text-[10px] text-sky-300 border border-sky-400/15">
            <Globe2 className="h-2.5 w-2.5" /> {player.country}
          </span>
        )}
        {player.battingStyle && <StyleChip>{player.battingStyle}</StyleChip>}
        {player.bowlingStyle && <StyleChip>{player.bowlingStyle}</StyleChip>}
        {player.age > 0 && <StyleChip>{player.age} yrs</StyleChip>}
      </div>

      {player.stats && (player.stats.matches > 0 || player.stats.runs > 0 || player.stats.wickets > 0) && (
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          {player.stats.matches > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <TrendingUp className="h-2.5 w-2.5" /> {player.stats.matches} M
            </span>
          )}
          {player.stats.runs > 0 && <span>{player.stats.runs} Runs</span>}
          {player.stats.wickets > 0 && <span>{player.stats.wickets} Wkts</span>}
        </div>
      )}

      {player.bio && (
        <p className="max-w-[260px] text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
          {player.bio}
        </p>
      )}
    </div>
  );
}

/* ─── ConfettiBurst (40 pieces, team-color aware) ─── */
function ConfettiBurst({ teamColors }: { teamColors?: string[] }) {
  const colors = teamColors?.length ? [...teamColors, ...CONFETTI_COLORS] : CONFETTI_COLORS;
  const pieces = Array.from({ length: 40 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const x = (Math.random() - 0.5) * 500;
        const y = 180 + Math.random() * 220;
        const rotate = Math.random() * 720 - 360;
        const delay = Math.random() * 0.25;
        const color = colors[i % colors.length];
        const isWide = Math.random() > 0.5;
        return (
          <motion.span
            key={i}
            className={cn("absolute left-1/2 top-1/3 rounded-sm", isWide ? "h-2 w-3" : "h-3 w-2")}
            style={{ background: color }}
            initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            animate={{ opacity: 0, x, y, rotate, scale: 0.2 }}
            transition={{ duration: 1.2 + Math.random() * 0.6, delay, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

/* ─── ShockwaveRings ─── */
function ShockwaveRings() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2 border-amber-400/15"
          initial={{ width: 120, height: 120, opacity: 0.5 }}
          animate={{ width: 700, height: 700, opacity: 0 }}
          transition={{ duration: 2.5, delay: i * 0.5, ease: "easeOut", repeat: Infinity, repeatDelay: 2 }}
        />
      ))}
    </div>
  );
}

/* ─── SpotlightBackground ─── */
function SpotlightBackground({ color = "amber" }: { color?: "amber" | "rose" }) {
  const gradient =
    color === "amber"
      ? "radial-gradient(circle at 50% 50%, rgba(251,191,36,0.1) 0%, transparent 55%)"
      : "radial-gradient(circle at 50% 50%, rgba(244,63,94,0.07) 0%, transparent 55%)";

  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      style={{ background: gradient }}
      animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.1, 1] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ─── Main Component ─── */
export function SoldUnsoldAnimation() {
  const { soldEvent, unsoldEvent, franchises, players } = useLiveAuction();

  const { active: activeSold, dismiss: dismissSold } = useDismissingEvent(soldEvent, SOLD_DURATION_MS);
  const { active: activeUnsold, dismiss: dismissUnsold } = useDismissingEvent(unsoldEvent, UNSOLD_DURATION_MS);

  const soldPlayer = activeSold ? players.find((p) => p.id === activeSold.playerId) : null;
  const soldFranchise = activeSold ? franchises.find((f) => f.id === activeSold.teamId) : null;
  const unsoldPlayer = activeUnsold ? players.find((p) => p.id === activeUnsold.playerId) : null;

  return (
    <AnimatePresence>
      {activeSold && soldPlayer && (
        <motion.div
          key={`sold-${activeSold.seq}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismissSold}
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[70] flex cursor-pointer items-center justify-center bg-slate-950/80 backdrop-blur-md"
        >
          <SpotlightBackground color="amber" />
          <ShockwaveRings />

          <motion.div
            initial={{ scale: 0.4, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
            className="relative flex w-full max-w-md flex-col items-center gap-4 overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-b from-slate-900/95 to-slate-950/95 px-10 py-10 text-center shadow-2xl shadow-amber-500/10 backdrop-blur-xl mx-4"
          >
            <ConfettiBurst teamColors={soldFranchise ? [soldFranchise.colorFrom, soldFranchise.colorTo] : undefined} />

            {/* Gavel */}
            <motion.div
              initial={{ rotate: -35, scale: 0.5, opacity: 0 }}
              animate={{ rotate: [0, -12, 6, 0], scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="relative"
            >
              <Gavel className="h-14 w-14 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]" />
              <motion.div
                className="absolute inset-0 rounded-full bg-amber-400/20 blur-2xl"
                animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0.15, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
            </motion.div>

            {/* SOLD! */}
            <motion.h2
              initial={{ y: 25, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-6xl font-black tracking-tighter"
              style={{
                background: "linear-gradient(135deg, #fbbf24, #f59e0b, #fcd34d, #fbbf24)",
                backgroundSize: "200% 200%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              SOLD!
            </motion.h2>

            {/* Player Avatar with team glow */}
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="relative"
            >
              {soldFranchise && (
                <motion.div
                  className="absolute -inset-3 rounded-[22px] blur-md"
                  style={{
                    background: `linear-gradient(135deg, ${soldFranchise.colorFrom}, ${soldFranchise.colorTo})`,
                    opacity: 0.35,
                  }}
                  animate={{ opacity: [0.25, 0.45, 0.25] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
              )}
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl ring-2 ring-offset-2 ring-offset-slate-950",
                  soldFranchise ? "ring-offset-[3px]" : "ring-white/10"
                )}
                style={soldFranchise ? { ringColor: soldFranchise.colorFrom } : undefined}
              >
                <CelebrationAvatar player={soldPlayer} size="xl" />
              </div>
            </motion.div>

            {/* Player Name */}
            <motion.p
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-3xl font-black text-white tracking-tight"
            >
              {soldPlayer.name}
            </motion.p>

            {/* Details */}
            <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}>
              <PlayerDetailsStrip player={soldPlayer} />
            </motion.div>

            {/* Franchise */}
            {soldFranchise && (
              <motion.div
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Sold To</span>
                <div className="flex items-center gap-3">
                  <FranchiseBadge franchise={soldFranchise} size="lg" />
                  <span
                    className="text-2xl font-black"
                    style={{
                      background: `linear-gradient(135deg, ${soldFranchise.colorFrom}, ${soldFranchise.colorTo})`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {soldFranchise.name}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Price */}
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.65, type: "spring", stiffness: 180 }}
              className="flex flex-col items-center gap-1"
            >
              <p className="text-5xl font-black text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.35)]">
                <AnimatedAmount value={activeSold.amount} />
              </p>
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Hammer Price</span>
            </motion.div>

            <p className="text-[10px] uppercase tracking-widest text-slate-600 mt-1">Tap anywhere to dismiss</p>
            <DismissTimer durationMs={SOLD_DURATION_MS} colorClass="bg-amber-400" />
          </motion.div>
        </motion.div>
      )}

      {activeUnsold && unsoldPlayer && (
        <motion.div
          key={`unsold-${activeUnsold.seq}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismissUnsold}
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[70] flex cursor-pointer items-center justify-center bg-slate-950/80 backdrop-blur-md"
        >
          <SpotlightBackground color="rose" />

          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, x: [0, -5, 5, -3, 3, 0] }}
            transition={{ type: "spring", stiffness: 220, damping: 14, x: { duration: 0.5, delay: 0.3 } }}
            className="relative flex w-full max-w-md flex-col items-center gap-4 overflow-hidden rounded-3xl border border-rose-500/20 bg-gradient-to-b from-slate-900/95 to-slate-950/95 px-10 py-10 text-center shadow-2xl shadow-rose-500/10 backdrop-blur-xl mx-4"
          >
            <XCircle className="h-14 w-14 text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.3)]" />

            <h2
              className="text-6xl font-black tracking-tighter text-rose-400"
              style={{ textShadow: "0 0 30px rgba(244,63,94,0.25)" }}
            >
              UNSOLD
            </h2>

            <div className="grayscale opacity-70">
              <CelebrationAvatar player={unsoldPlayer} size="lg" />
            </div>

            <p className="text-3xl font-black text-white tracking-tight">{unsoldPlayer.name}</p>

            <PlayerDetailsStrip player={unsoldPlayer} />

            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">No takers at base price</span>
              <span className="text-2xl font-bold text-slate-400 line-through decoration-rose-500/40 decoration-2">
                {formatLakhs(unsoldPlayer.basePrice)}
              </span>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 border border-rose-500/20">
              Returns to Player Pool
            </span>

            <p className="text-[10px] uppercase tracking-widest text-slate-600 mt-1">Tap anywhere to dismiss</p>
            <DismissTimer durationMs={UNSOLD_DURATION_MS} colorClass="bg-rose-400" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}