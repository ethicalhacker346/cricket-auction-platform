import { useMemo } from "react";
import { Users2, Wallet, Loader2, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  useAuth,
  useLiveAuction,
  useAuctionPermissions,
} from "@/features/auction/hooks/index.hook";
import { useRoleStore, useLiveAuctionStore } from "@/features/auction/store/index.store";
import { AuctionClock } from "@/features/auction/components/AuctionClock";
import { CurrentHighestBid } from "@/features/auction/components/CurrentHighestBid";
import { PlayerAuctionCard } from "@/features/auction/components/PlayerAuctionCard";
import { BidPanel } from "@/features/auction/components/BidPanel";
import { TeamRosterCard } from "@/features/auction/components/TeamCards";
import { SoldUnsoldAnimation } from "@/features/auction/components/SoldUnsoldAnimation";
import { RoundProgress } from "@/features/auction/components/AuctionSidebar";
import { BidHistoryPanel } from "@/features/auction/components/ActivityFeeds";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { CurrentRoundBadge } from "@/features/auction/components/Badges";
import { cn } from "@/utils/cn";

export default function FranchiseAuctionPage() {
  const { isAuthenticated, hasHydrated } = useAuth();
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);
  const userTeamId = useRoleStore((s) => s.userTeamId);

  const { franchises, players, currentRound, currentPlayer, status, connection } = useLiveAuction(
    storeAuctionId || undefined,
    storeTournamentId || undefined
  );

  const permissions = useAuctionPermissions();

  const franchise = useMemo(
    () => franchises.find((f) => f.id === userTeamId),
    [franchises, userTeamId]
  );

  const remaining = franchise ? franchise.purseTotal - franchise.spent : 0;

  // Auth & hydration guards
  if (!hasHydrated) {
    return (
      <div className="mx-auto flex max-w-6xl items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 py-32 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Authentication Required</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Sign in to access your team console and place bids.
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
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 py-32 text-center">
        <Users2 className="h-12 w-12 text-slate-500" />
        <h2 className="text-lg font-bold text-white">No Active Auction</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Select a tournament from the dashboard to enter the team console.
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

  if (!franchise) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 py-32 text-center">
        <Wallet className="h-12 w-12 text-slate-500" />
        <h2 className="text-lg font-bold text-white">No Franchise Assigned</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Your account is not linked to any franchise for this auction.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-6xl space-y-4 pb-4"
    >
      <SoldUnsoldAnimation />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-transparent p-5">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${franchise.colorFrom}, ${franchise.colorTo})`,
            }}
          >
            {initials(franchise.shortName)}
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <Users2 className="h-3.5 w-3.5" /> Team Console
            </p>
            <h1 className="text-lg font-black text-white">{franchise.name}</h1>
          </div>
        </div>

        {currentRound && (
          <CurrentRoundBadge name={currentRound.name} type={currentRound.type} />
        )}

        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10">
          <Wallet className="h-4 w-4 text-emerald-400" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              My Purse Remaining
            </p>
            <p className="text-base font-bold text-emerald-400">{formatLakhs(remaining)}</p>
          </div>
        </div>
      </div>

      {/* Connection warning */}
      {connection !== "connected" && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          {connection === "connecting"
            ? "Connecting to live auction…"
            : connection === "reconnecting"
            ? "Reconnecting to live auction…"
            : "Offline — bids may not sync in real-time"}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <PlayerAuctionCard player={currentPlayer} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <AuctionClock
                size={120}
                auctionId={storeAuctionId || undefined}
                tournamentId={storeTournamentId || undefined}
              />
            </div>
            <CurrentHighestBid />
          </div>
          <BidPanel teamId={franchise.id} />
        </div>

        <div className="space-y-4">
          <TeamRosterCard franchise={franchise} players={players} />
          <div className="h-64">
            <BidHistoryPanel limit={10} />
          </div>
          <RoundProgress />
        </div>
      </div>
    </motion.div>
  );
}