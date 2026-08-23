import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Gavel, Loader2, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import type {
  AuctionStatus,
  Franchise,
  Player,
} from "@/features/auction/types/index.types";
import { useBid } from "@/features/auction/hooks/index.hook";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";

interface BidPermissionShape {
  loading: boolean;
  canBid: boolean;
}

interface Auction3DBidDockProps {
  auctionId: string;
  player: Player | null;
  players: Player[];
  userTeam: Franchise | null;
  currentBid: { amount: number; teamId: string | null };
  timer: { remaining: number; total: number; isRunning: boolean };
  status: AuctionStatus;
  connection: "connecting" | "connected" | "reconnecting" | "offline";
  permissions: BidPermissionShape;
  compact?: boolean;
}

function TeamIdentity({ team }: { team: Franchise }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [team.logo]);

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {team.logo && !failed ? (
        <img
          src={team.logo}
          alt=""
          onError={() => setFailed(true)}
          className="h-10 w-10 shrink-0 rounded-xl bg-white/5 object-contain ring-1 ring-white/10"
        />
      ) : (
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-black text-white ring-1 ring-white/10"
          style={{ background: `linear-gradient(135deg, ${team.colorFrom}, ${team.colorTo})` }}
        >
          {initials(team.shortName)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-black text-white">{team.shortName}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
          <Wallet className="h-3 w-3" /> {formatLakhs(Math.max(0, team.purseTotal - team.spent))} left
        </p>
      </div>
    </div>
  );
}

export function Auction3DBidDock({
  auctionId,
  player,
  players,
  userTeam,
  currentBid,
  timer,
  status,
  connection,
  permissions,
  compact = false,
}: Auction3DBidDockProps) {
  // Hooks must remain unconditional even for spectators; the empty ID is
  // never submitted because the preflight blocker below disables bidding.
  const { placeBid, isPlacing, lastError, flashSeq, nextBidAmount } = useBid(
    userTeam?.id ?? "",
    auctionId,
  );

  const isLeading = Boolean(userTeam && currentBid.teamId === userTeam.id);

  const blocker = useMemo(() => {
    if (permissions.loading) return "Checking bid access…";
    if (!player) return "Waiting for the next lot";
    if (status === "paused") return "Auction is paused";
    if (status === "completed") return "Auction has completed";
    if (status !== "live") return "Bidding is not open";
    if (connection !== "connected") return "Reconnecting to the live room";
    if (!timer.isRunning || timer.remaining <= 0) return "The bid window is closed";
    if (!permissions.canBid) return "Spectator mode — bidding unavailable";
    if (!userTeam) return "No franchise is assigned to this account";
    if (isLeading) return "You are the highest bidder";

    const remainingPurse = userTeam.purseTotal - userTeam.spent;
    if (nextBidAmount > remainingPurse) return "Insufficient purse for the next bid";
    if (userTeam.squad.length >= userTeam.maxSquadSize) return "Your squad is full";

    if (player.overseas) {
      const overseasCount = userTeam.squad.reduce((count, playerId) => {
        return count + (players.find((candidate) => candidate.id === playerId)?.overseas ? 1 : 0);
      }, 0);
      if (overseasCount >= userTeam.maxOverseas) return "Overseas player quota reached";
    }

    return null;
  }, [
    connection,
    isLeading,
    nextBidAmount,
    permissions.canBid,
    permissions.loading,
    player,
    players,
    status,
    timer.isRunning,
    timer.remaining,
    userTeam,
  ]);

  const canSubmit = !blocker && !isPlacing;
  const buttonTone = isLeading
    ? "bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 text-slate-950 shadow-[0_12px_45px_rgba(52,211,153,.22)]"
    : blocker
      ? "bg-gradient-to-r from-slate-800 to-slate-700 text-slate-400 shadow-none"
      : "bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 text-slate-950 shadow-[0_12px_45px_rgba(251,191,36,.24)] hover:brightness-110";

  const submitBid = useCallback(() => {
    if (!canSubmit) return;
    void placeBid(nextBidAmount);
  }, [canSubmit, nextBidAmount, placeBid]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b" || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button, [contenteditable='true']")) return;
      event.preventDefault();
      submitBid();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submitBid]);

  if (compact) {
    return (
      <button
        type="button"
        onClick={submitBid}
        disabled={!canSubmit}
        aria-describedby="auction-3d-bid-state"
        className={`group relative flex min-w-[168px] items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed ${buttonTone}`}
      >
        {isPlacing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
        {isLeading ? "YOU'RE LEADING" : player ? `BID ${formatLakhs(nextBidAmount)}` : "WAITING"}
        <span id="auction-3d-bid-state" className="sr-only">{blocker ?? "Bid is available"}</span>
      </button>
    );
  }

  return (
    <motion.section
      animate={flashSeq ? { scale: [1, 1.025, 1] } : undefined}
      transition={{ duration: 0.32 }}
      aria-label="Live bidding console"
      className="relative w-[min(720px,calc(100vw-24px))] overflow-hidden rounded-[22px] border border-white/12 bg-[#050813]/92 p-2.5 shadow-[0_24px_90px_rgba(0,0,0,.58)] backdrop-blur-2xl sm:p-3"
    >
      <div className="pointer-events-none absolute inset-x-24 -top-px h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 sm:grid-cols-[170px_minmax(145px,1fr)_210px]">
        <div className="hidden min-w-0 sm:block">
          {userTeam ? (
            <TeamIdentity team={userTeam} />
          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-bold">Spectator console</span>
            </div>
          )}
        </div>

        <div className="min-w-0 px-1 text-left sm:text-center">
          <p className="truncate text-[9px] font-black uppercase tracking-[0.24em] text-slate-500">
            {isLeading ? "Your winning bid" : "Next valid bid"}
          </p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={isLeading ? currentBid.amount : nextBidAmount}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -7 }}
              className={`mt-0.5 truncate text-2xl font-black tracking-[-0.05em] sm:text-3xl ${
                isLeading ? "text-emerald-300" : "text-white"
              }`}
            >
              {formatLakhs(isLeading ? currentBid.amount : nextBidAmount)}
            </motion.p>
          </AnimatePresence>
          <p id="auction-3d-bid-state" className="mt-0.5 truncate text-[10px] text-slate-500" aria-live="polite">
            {lastError ? <span className="text-rose-300">{lastError}</span> : blocker ?? "Press B or use the hammer"}
          </p>
        </div>

        <button
          type="button"
          onClick={submitBid}
          disabled={!canSubmit}
          aria-describedby="auction-3d-bid-state"
          className={`group relative flex h-[54px] min-w-[148px] items-center justify-center gap-2 overflow-hidden rounded-2xl px-4 text-sm font-black transition duration-200 active:translate-y-0 disabled:cursor-not-allowed sm:h-[60px] sm:text-[15px] ${buttonTone} ${canSubmit ? "hover:-translate-y-0.5" : ""}`}
        >
          {!blocker ? (
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          ) : null}
          {isPlacing ? (
            <Loader2 className="relative h-5 w-5 animate-spin" />
          ) : isLeading ? (
            <Sparkles className="relative h-5 w-5" />
          ) : blocker ? (
            <AlertTriangle className="relative h-5 w-5" />
          ) : (
            <Gavel className="relative h-5 w-5 transition-transform group-hover:-rotate-12" />
          )}
          <span className="relative">
            {isPlacing ? "PLACING…" : isLeading ? "YOU'RE LEADING" : blocker ? "BID LOCKED" : "PLACE BID"}
          </span>
        </button>
      </div>
    </motion.section>
  );
}
