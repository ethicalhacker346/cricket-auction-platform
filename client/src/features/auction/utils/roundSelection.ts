import type { AuctionRound, Player } from '../types/index.types';

/** Mirrors AuctionService.runningRound: never jump to a later round. */
export function runningAuctionRound(rounds: AuctionRound[]): AuctionRound | null {
  const ordered = [...rounds].sort((a, b) => a.order - b.order);
  return ordered.find((round) => round.status === 'active')
    ?? ordered.find((round) => round.status === 'pending' && round.playerIds.length > 0)
    ?? null;
}

export function eligibleRoundPlayers(round: AuctionRound, players: Player[]): Player[] {
  if (round.status === 'completed') return [];
  const byId = new Map(players.map((player) => [player.id, player]));
  return round.playerIds.flatMap((id) => {
    const player = byId.get(id);
    const eligible = player && (player.status === 'pending' || (round.type === 'unsold' && player.status === 'unsold'));
    return eligible ? [player] : [];
  });
}

/** Eligible queue across unfinished rounds; arbitrary lot order never hides an earlier player. */
export function upcomingAuctionPlayers(rounds: AuctionRound[], players: Player[], limit = 8): Player[] {
  const seen = new Set<string>();
  return [...rounds].sort((left, right) => left.order - right.order)
    .flatMap((round) => eligibleRoundPlayers(round, players))
    .filter((player) => { if (seen.has(player.id)) return false; seen.add(player.id); return true; })
    .slice(0, limit);
}
