import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Users2,
  Wallet,
  Loader2,
  ShieldAlert,
  Activity,
  Radio,
  Eye,
  Zap,
  Clock,
  Wifi,
  WifiOff,
  AlertCircle,
  Gavel,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Globe2,
} from "lucide-react";
import {
  useAuth,
  useLiveAuction,
  useAuctionPermissions,
  useResolvedUserTeam,
} from "@/features/auction/hooks/index.hook";
import { useRoleStore, useLiveAuctionStore } from "@/features/auction/store/index.store";
import { AuctionClock } from "@/features/auction/components/AuctionClock";
import { CurrentHighestBid } from "@/features/auction/components/CurrentHighestBid";
import { PlayerAuctionCard } from "@/features/auction/components/PlayerAuctionCard";
import { BidPanel } from "@/features/auction/components/BidPanel";
import { TeamRosterCard } from "@/features/auction/components/TeamCards";
import { SoldUnsoldAnimation } from "@/features/auction/components/SoldUnsoldAnimation";
import { RoundProgress, PlayerQueue } from "@/features/auction/components/AuctionSidebar";
import { BidHistoryPanel, AuctionLogs } from "@/features/auction/components/ActivityFeeds";
import { FranchisePanel } from "@/features/auction/components/FranchisePanel";
import {
  CurrentRoundBadge,
  AuctionStatusBadge,
  ConnectionDot,
} from "@/features/auction/components/Badges";
import { formatLakhs, initials, formatClockTime } from "@/features/auction/utils/index.utils";
import { cn } from "@/utils/cn";

/* ═══════════════════════════════════════════════════════════════════════════════
   STAGGER VARIANTS
   ═══════════════════════════════════════════════════════════════════════════════ */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 260, damping: 22 },
  },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════════
   STAT CARD (inline micro-component)
   ═══════════════════════════════════════════════════════════════════════════════ */
function StatCard({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone?: "slate" | "emerald" | "amber" | "rose" | "sky";
}) {
  const toneMap = {
    slate: "text-slate-400 bg-white/[0.03] border-white/[0.06]",
    emerald: "text-emerald-400 bg-emerald-500/[0.04] border-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/[0.04] border-amber-500/10",
    rose: "text-rose-400 bg-rose-500/[0.04] border-rose-500/10",
    sky: "text-sky-400 bg-sky-500/[0.04] border-sky-500/10",
  };

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3.5 backdrop-blur-sm",
        toneMap[tone]
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </p>
        <p className="truncate text-sm font-extrabold text-white">{value}</p>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function FranchiseAuctionPage() {
  const { isAuthenticated, hasHydrated, user } = useAuth();
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);
  const userTeamId = useRoleStore((s) => s.userTeamId);

  /* ── CORRECT: useLiveAuction expects an options object, not positional args ── */
  const liveAuction = useLiveAuction(
    storeAuctionId && storeTournamentId
      ? { auctionId: storeAuctionId, tournamentId: storeTournamentId }
      : undefined
  );

  const {
    franchises,
    players,
    currentRound,
    currentPlayer,
    status,
    connection,
    currentBid,
    nextBidAmount,
    viewerCount,
    serverLatencyMs,
    playersSoldCount,
    playersUnsoldCount,
    totalMoneySpent,
    actions,
  } = liveAuction;

  /* ── CORRECT: pass auctionId so permissions fetch the right policy ── */
  const permissions = useAuctionPermissions(storeAuctionId || undefined);

  const franchise = useMemo(() => {
    if (!user) return null;

    return franchises.find(
        f => f.ownerId === user.id
    ) ?? null;
}, [franchises, user]);

  const remaining = franchise
    ? franchise.purseTotal - franchise.spent - (franchise.reservedBudget || 0)
    : 0;

  const spentPct =
    franchise && franchise.purseTotal > 0
      ? ((franchise.spent + (franchise.reservedBudget || 0)) / franchise.purseTotal) * 100
      : 0;

  const isLive = status === "live";
  const isPaused = status === "paused";

  /* ═══════════════════════════════════════════════════════════════════════════
     GUARDS
     ═══════════════════════════════════════════════════════════════════════════ */
  if (!hasHydrated) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 py-32 text-center"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500/10 ring-1 ring-rose-500/20">
          <ShieldAlert className="h-10 w-10 text-rose-400" />
        </div>
        <h2 className="text-xl font-black text-white">Authentication Required</h2>
        <p className="max-w-sm text-sm leading-relaxed text-slate-400">
          Sign in to access your team console, manage bids, and track the live auction.
        </p>
        <Link
          to="/login"
          className="mt-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110"
        >
          Sign In
        </Link>
      </motion.div>
    );
  }

  if (!storeAuctionId || !storeTournamentId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 py-32 text-center"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10">
          <Users2 className="h-10 w-10 text-slate-500" />
        </div>
        <h2 className="text-xl font-black text-white">No Active Auction</h2>
        <p className="max-w-sm text-sm leading-relaxed text-slate-400">
          Select a tournament from the dashboard to enter the team console.
        </p>
        <Link
          to="/"
          className="mt-2 rounded-xl bg-white/10 px-6 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
        >
          Go to Dashboard
        </Link>
      </motion.div>
    );
  }

  if (!franchise) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 py-32 text-center"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10">
          <Wallet className="h-10 w-10 text-slate-500" />
        </div>
        <h2 className="text-xl font-black text-white">No Franchise Assigned</h2>
        <p className="max-w-sm text-sm leading-relaxed text-slate-400">
          Your account is not linked to any franchise for this auction. Contact the organizer.
        </p>
      </motion.div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="mx-auto max-w-7xl space-y-5 px-4 pb-12 pt-4"
    >
      <SoldUnsoldAnimation />

      {/* ── Live Stats Ribbon ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon={isLive ? Radio : isPaused ? PauseCircle : Activity}
          label="Auction"
          value={<AuctionStatusBadge status={status} />}
          tone={isLive ? "emerald" : isPaused ? "amber" : "slate"}
        />
        <StatCard
          icon={Eye}
          label="Viewers"
          value={viewerCount ?? 0}
          tone="sky"
        />
        <StatCard
          icon={Zap}
          label="Latency"
          value={`${serverLatencyMs ?? 0}ms`}
          tone={serverLatencyMs > 500 ? "rose" : "emerald"}
        />
        <StatCard
          icon={CheckCircle2}
          label="Sold"
          value={`${playersSoldCount ?? 0}`}
          tone="emerald"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Spent"
          value={formatLakhs(totalMoneySpent ?? 0)}
          tone="amber"
        />
        <StatCard
          icon={Clock}
          label="Time"
          value={formatClockTime()}
          tone="slate"
        />
      </div>

      {/* ── Header ── */}
      <motion.header
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-white/[0.07] to-transparent p-5 sm:p-6"
      >
        {/* Ambient franchise glow */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[80px] opacity-20"
          style={{
            background: `linear-gradient(135deg, ${franchise.colorFrom}, ${franchise.colorTo})`,
          }}
        />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-base font-black text-white shadow-xl ring-1 ring-white/20"
              style={{
                background: `linear-gradient(135deg, ${franchise.colorFrom}, ${franchise.colorTo})`,
              }}
            >
              {initials(franchise.shortName)}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  <Users2 className="h-3.5 w-3.5" /> Team Console
                </p>
                <ConnectionDot connection={connection} />
                {isLive && (
                  <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                )}
              </div>
              <h1 className="mt-0.5 text-xl font-black tracking-tight text-white sm:text-2xl">
                {franchise.name}
              </h1>
            </div>
          </div>

          {/* Center: Round + Status */}
          <div className="flex items-center gap-3">
            {currentRound && (
              <CurrentRoundBadge
                name={currentRound.name}
                type={currentRound.type}
              />
            )}
          </div>

          {/* Right: Purse */}
          <div className="flex min-w-[200px] items-center gap-3 rounded-2xl bg-white/5 px-5 py-3 ring-1 ring-white/10 backdrop-blur-sm">
            <Wallet className="h-5 w-5 shrink-0 text-emerald-400" />
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Purse Remaining
              </p>
              <div className="flex items-center gap-3">
                <p
                  className={cn(
                    "text-lg font-black tracking-tight",
                    remaining < 0
                      ? "text-rose-400"
                      : remaining < franchise.purseTotal * 0.15
                      ? "text-amber-400"
                      : "text-emerald-400"
                  )}
                >
                  {formatLakhs(remaining)}
                </p>
                <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-white/10 sm:block">
                  <motion.div
                    className={cn(
                      "h-full rounded-full",
                      spentPct > 85
                        ? "bg-rose-400"
                        : spentPct > 60
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, 100 - spentPct)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Connection Warning ── */}
      <AnimatePresence>
        {connection !== "connected" && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-5 py-3 text-sm font-medium backdrop-blur-sm",
                connection === "offline"
                  ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-300"
              )}
            >
              {connection === "offline" ? (
                <WifiOff className="h-4 w-4 shrink-0" />
              ) : (
                <Wifi className="h-4 w-4 shrink-0 animate-pulse" />
              )}
              <span>
                {connection === "connecting"
                  ? "Connecting to live auction…"
                  : connection === "reconnecting"
                  ? "Reconnecting to live auction…"
                  : "Offline — bids may not sync in real-time. Check your network."}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Organizer Toolbar (permission-gated) ── */}
      <AnimatePresence>
        {(permissions.canOpenLot ||
          permissions.canMarkSold ||
          permissions.canMarkUnsold ||
          permissions.canPause ||
          permissions.canResume) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            variants={itemVariants}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-3 backdrop-blur-sm">
              <span className="px-2 text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                <Gavel className="mr-1 inline h-3 w-3" /> Auction Controls
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {permissions.canOpenLot && (
                  <button
                    onClick={() => actions.openNextLot()}
                    className="rounded-xl bg-indigo-500/15 px-4 py-2 text-xs font-bold text-indigo-300 ring-1 ring-indigo-500/30 transition hover:bg-indigo-500/25"
                  >
                    Open Next Lot
                  </button>
                )}
                {permissions.canMarkSold && (
                  <button
                    onClick={() => actions.forceSold()}
                    className="rounded-xl bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
                  >
                    Mark Sold
                  </button>
                )}
                {permissions.canMarkUnsold && (
                  <button
                    onClick={() => actions.forceUnsold()}
                    className="rounded-xl bg-rose-500/15 px-4 py-2 text-xs font-bold text-rose-300 ring-1 ring-rose-500/30 transition hover:bg-rose-500/25"
                  >
                    Mark Unsold
                  </button>
                )}
                {permissions.canPause && isLive && (
                  <button
                    onClick={() => actions.pause()}
                    className="rounded-xl bg-amber-500/15 px-4 py-2 text-xs font-bold text-amber-300 ring-1 ring-amber-500/30 transition hover:bg-amber-500/25"
                  >
                    Pause
                  </button>
                )}
                {permissions.canResume && isPaused && (
                  <button
                    onClick={() => actions.resume()}
                    className="rounded-xl bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
                  >
                    Resume
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* ═══════════════ LEFT COLUMN ═══════════════ */}
        <motion.div className="space-y-5" variants={itemVariants}>
          <PlayerAuctionCard
            player={currentPlayer}
            nextBidAmount={nextBidAmount}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <motion.div
              variants={itemVariants}
              className="flex items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm"
            >
              <AuctionClock size={150} />
            </motion.div>
            <motion.div variants={itemVariants}>
              <CurrentHighestBid />
            </motion.div>
          </div>

          <motion.div variants={itemVariants}>
            <BidPanel teamId={franchise.id} />
          </motion.div>

          {/* All Franchises Overview */}
          <motion.div variants={itemVariants}>
            <FranchisePanel />
          </motion.div>
        </motion.div>

        {/* ═══════════════ RIGHT COLUMN ═══════════════ */}
        <motion.div className="space-y-5" variants={itemVariants}>
          <motion.div variants={itemVariants}>
            <TeamRosterCard franchise={franchise} players={players} />
          </motion.div>

          <motion.div variants={itemVariants}>
            <PlayerQueue />
          </motion.div>

          <motion.div variants={itemVariants} className="h-64">
            <BidHistoryPanel limit={15} />
          </motion.div>

          <motion.div variants={itemVariants} className="h-52">
            <AuctionLogs limit={12} />
          </motion.div>

          <motion.div variants={itemVariants}>
            <RoundProgress />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}