import { useMemo } from "react";
import { AlertCircle, Gavel, Loader2, Zap } from "lucide-react";
import { useBid, useLiveAuction, useAuth } from "@/features/auction/hooks/index.hook";
import { useRoleStore } from "@/features/auction/store/index.store";
import { formatLakhs, getNextIncrement } from "@/features/auction/utils/index.utils";
import { cn } from "@/utils/cn";

export function BidPanel({ teamId }: { teamId?: string }) {
  const userTeamId = useRoleStore((s) => s.userTeamId);
  const { user } = useAuth();
  const activeTeamId = teamId ?? userTeamId ?? user?.teamId;

  const { currentPlayer, currentBid, franchises, auction, status, nextBidAmount: storeNextBid } = useLiveAuction();
  const { placeBid, isPlacing, lastError } = useBid(activeTeamId!);

  const franchise = franchises.find((f) => f.id === activeTeamId);
  const isLeading = currentBid.teamId === activeTeamId;
  const canBid = status === "live" && !!currentPlayer && !isLeading && !!franchise && !!activeTeamId;

  const remainingPurse = franchise 
    ? franchise.purseTotal - franchise.spent - (franchise.reservedBudget || 0) 
    : 0;

  const increments = auction?.rules?.bidIncrements ?? [];
  const increment = getNextIncrement(currentBid.amount, increments);

  const quickJumps = useMemo(() => {
    if (!currentPlayer || !increments.length || !activeTeamId) return [];
    return [1, 2, 5].map((mult) => currentBid.amount + increment * mult);
  }, [currentBid.amount, increment, currentPlayer, increments.length, activeTeamId]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <Gavel className="h-3.5 w-3.5" /> Bid as {franchise?.shortName ?? "—"}
        </p>
        {franchise && (
          <span className="text-xs text-slate-500">
            Purse left:{" "}
            <span className="font-semibold text-emerald-400">{formatLakhs(remainingPurse)}</span>
          </span>
        )}
      </div>

      <button
        onClick={() => placeBid()}
        disabled={!canBid || isPlacing || !activeTeamId}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-30",
          isLeading
            ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
            : "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20 hover:brightness-110"
        )}
      >
        {isPlacing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isLeading ? (
          "You're the highest bidder"
        ) : (
          <>Bid {formatLakhs(storeNextBid)}</>
        )}
      </button>

      {quickJumps.length > 0 && (
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {quickJumps.map((amount) => (
            <button
              key={amount}
              onClick={() => placeBid(amount)}
              disabled={!canBid || isPlacing || amount > remainingPurse}
              className="flex items-center justify-center gap-1 rounded-lg bg-white/5 py-2 text-xs font-medium text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Zap className="h-3 w-3 text-amber-400" /> {formatLakhs(amount)}
            </button>
          ))}
        </div>
      )}

      {lastError && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5" /> {lastError}
        </p>
      )}
      {!currentPlayer && (
        <p className="mt-2.5 text-xs text-slate-500">Bidding opens once a lot goes live.</p>
      )}
      {!franchise && (
        <p className="mt-2.5 text-xs text-rose-400">No franchise assigned to this account.</p>
      )}
      {!activeTeamId && (
        <p className="mt-2.5 text-xs text-rose-400">Team ID required for bidding.</p>
      )}
    </div>
  );
}