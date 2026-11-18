import { useCallback, useEffect, useState } from "react";
import { useLiveAuctionStore } from "../store/index.store";
import type { LiveAuctionSnapshot, PlayerRole } from "../types/index.types";

interface VerdictData {
  id: string;
  playerName: string;
  playerRole: PlayerRole;
  isSold: boolean;
  teamName?: string;
  teamLogoUrl?: string;
  teamColor?: string;
  soldAmount?: number;
}

type VerdictEvent =
  | (NonNullable<LiveAuctionSnapshot["soldEvent"]> & { isSold: true })
  | (NonNullable<LiveAuctionSnapshot["unsoldEvent"]> & { isSold: false });

function latestVerdict(state: LiveAuctionSnapshot): VerdictEvent | null {
  const { soldEvent, unsoldEvent } = state;
  // The engine uses one monotonic sequence across both event kinds.
  if (soldEvent && (!unsoldEvent || soldEvent.seq > unsoldEvent.seq)) {
    return { ...soldEvent, isSold: true };
  }
  return unsoldEvent ? { ...unsoldEvent, isSold: false } : null;
}

/**
 * A mounted page watches NEW verdicts, not the last persisted outcome.
 * Subscribe directly so 250ms clock snapshots don't re-render the reveal,
 * reset its deadline, replay its sound, or resurrect a dismissed event.
 * Presentation data is captured once, so later pool/roster reconciliation
 * cannot erase the name/team from a reveal that's already on screen.
 */
export function useAuctionVerdict() {
  const [active, setActive] = useState<VerdictData | null>(null);

  useEffect(() => {
    const initial = useLiveAuctionStore.getState();
    let scope = `${initial.tournamentId}:${initial.auctionId}`;
    let seenSequence = latestVerdict(initial)?.seq ?? 0;

    return useLiveAuctionStore.subscribe((state, previous) => {
      const nextScope = `${state.tournamentId}:${state.auctionId}`;
      const event = latestVerdict(state);
      if (nextScope !== scope || !state.auctionId || state.auction.id !== state.auctionId) {
        scope = nextScope;
        seenSequence = event?.seq ?? 0;
        setActive(null);
        return;
      }

      // Opening the next lot takes precedence over a catch-up verdict from
      // the previous lot. Never leave a celebration blocking live bidding.
      if (state.currentPlayerId && state.currentPlayerId !== previous.currentPlayerId) {
        seenSequence = event?.seq ?? seenSequence;
        setActive(null);
        return;
      }

      if (!event) {
        seenSequence = 0; // a reset engine starts a fresh sequence
        setActive(null);
        return;
      }
      if (event.seq <= seenSequence) return;

      const player = state.players.find((p) => p.id === event.playerId);
      // If the roster arrives just after the event, wait for it rather
      // than showing an anonymous/blank overlay or losing the event.
      if (!player) return;
      const team = event.isSold ? state.franchises.find((f) => f.id === event.teamId) : undefined;
      seenSequence = event.seq;
      setActive({
        id: `${scope}:${event.isSold ? "sold" : "unsold"}:${event.seq}`,
        playerName: player.name,
        playerRole: player.role,
        isSold: event.isSold,
        teamName: event.isSold ? team?.name ?? player.soldToTeamName ?? "Winning team" : undefined,
        teamLogoUrl: team?.logo,
        teamColor: team?.colorFrom,
        soldAmount: event.isSold ? event.amount : undefined,
      });
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    // An exiting overlay's timeout/callback must not close its successor.
    setActive((current) => current?.id === id ? null : current);
  }, []);

  return { active, dismiss };
}
