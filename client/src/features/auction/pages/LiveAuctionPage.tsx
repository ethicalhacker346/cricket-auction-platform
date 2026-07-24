import { Loader2, ShieldAlert, Gavel, WifiOff, RadioTower } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  useAuth,
  useLiveAuction,
  useAuctionPermissions,
} from "@/features/auction/hooks/index.hook";
import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { AuctionControls } from "@/features/auction/components/AuctionControls";
import { AuctionClock } from "@/features/auction/components/AuctionClock";
import { CurrentHighestBid } from "@/features/auction/components/CurrentHighestBid";
import { PlayerAuctionCard } from "@/features/auction/components/PlayerAuctionCard";
import { FranchisePanel } from "@/features/auction/components/FranchisePanel";
import { BidHistoryPanel, AuctionLogs } from "@/features/auction/components/ActivityFeeds";
import { PlayerQueue, RoundProgress } from "@/features/auction/components/AuctionSidebar";
import { LiveStatistics } from "@/features/auction/components/LiveStatistics";
import { SoldUnsoldAnimation } from "@/features/auction/components/SoldUnsoldAnimation";
import { AuctionFooter } from "@/features/auction/components/AuctionFooter";
import { CurrentRoundBadge, AuctionStatusBadge } from "@/features/auction/components/Badges";
import { ConnectionDot } from "@/features/auction/components/Badges";

export default function LiveAuctionPage() {
  const { isAuthenticated, hasHydrated } = useAuth();
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);

  const {
    currentRound,
    currentPlayer,
    nextBidAmount,
    status,
    connection,
    serverLatencyMs,
  } = useLiveAuction({
    auctionId: storeAuctionId || undefined,
    tournamentId: storeTournamentId || undefined,
  });

  const permissions = useAuctionPermissions();
  const reduceMotion = useReducedMotion();

  // Auth & hydration guards
  if (!hasHydrated) {
    return (
      <div className="mx-auto flex max-w-[1500px] items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex max-w-[1500px] flex-col items-center justify-center gap-4 py-32 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Authentication Required</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Sign in to watch and participate in the live auction.
        </p>
        <Link
          to="/login"
          className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (!storeAuctionId || !storeTournamentId) {
    return (
      <div className="mx-auto flex max-w-[1500px] flex-col items-center justify-center gap-4 py-32 text-center">
        <Gavel className="h-12 w-12 text-slate-500" />
        <h2 className="text-lg font-bold text-white">No Active Auction</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Select a tournament from the dashboard to enter the live auction room.
        </p>
        <Link
          to="/"
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto -mt-1 max-w-[1500px] space-y-4 pb-4"
    >
      <SoldUnsoldAnimation />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-black text-white sm:text-2xl">Live Auction Room</h1>
          <AuctionStatusBadge status={status} />
          {status === "live" && connection === "connected" && (
            <span className="hidden items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-400/30 sm:flex">
              <RadioTower className="h-3 w-3" /> Live
            </span>
          )}
          {currentRound && (
            <CurrentRoundBadge name={currentRound.name} type={currentRound.type} />
          )}
          {/* Server permissions are authoritative (see @deprecated note on
             computePermissions in index.utils.ts) — this chip is purely
             informational, reflecting the decision already fetched here,
             not deriving one client-side. */}
          {!permissions.loading && (
            <span className="hidden items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ring-1 ring-white/10 sm:flex">
              Viewing as {permissions.canManageAuction ? "Organizer" : permissions.canBid ? "Team" : "Spectator"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {connection && (
            <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">
              <ConnectionDot connection={connection} />
              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                {connection}
              </span>
              {serverLatencyMs > 0 && (
                <span className="text-[10px] text-slate-600">{serverLatencyMs}ms</span>
              )}
            </div>
          )}
          {status === "completed" && (
            <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-300 ring-1 ring-violet-500/30">
              Auction Completed — visit Results
            </span>
          )}
        </div>
      </div>

      {(connection === "reconnecting" || connection === "offline") && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          {connection === "offline"
            ? "Lost connection to the live auction — retrying automatically. What you're seeing may be a few seconds behind."
            : "Reconnecting to the live auction — data may be a few seconds behind until it catches up."}
        </div>
      )}

      <LiveStatistics />

      {/* Main 3-column layout */}
      <motion.div
        initial={reduceMotion ? false : "hidden"}
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08 } },
        }}
        className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)]"
      >
        {/* Column 1: current lot + controls */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
          className="space-y-4"
        >
          <PlayerAuctionCard
             player={currentPlayer}
             nextBidAmount={nextBidAmount}
             compact={false}
           />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <AuctionClock
                auctionId={storeAuctionId || undefined}
                tournamentId={storeTournamentId || undefined}
              />
            </div>
            <CurrentHighestBid />
          </div>
          <FranchisePanel />
          <AuctionControls />
        </motion.div>

        {/* Column 2: bid feed + logs */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1 xl:gap-4"
        >
          <div className="h-80">
            <BidHistoryPanel limit={14} />
          </div>
          <div className="h-80">
            <AuctionLogs limit={14} />
          </div>
        </motion.div>

        {/* Column 3: sidebar */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
          className="space-y-4"
        >
          <PlayerQueue />
          <RoundProgress />
        </motion.div>
      </motion.div>

      <AuctionFooter />
    </motion.div>
  );
}