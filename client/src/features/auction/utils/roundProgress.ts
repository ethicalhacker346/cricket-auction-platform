import type { AuctionRound, Player } from '../types/index.types';

/** Pass outcomes, not a projection of what those same players did in later passes. */
export function roundProgress(round: AuctionRound, players: ReadonlyMap<string, Player>) {
  const total = round.playerIds.length;
  const historical = round.status === 'completed';
  const legacy = historical && !round.outcomeSummary;
  let sold = 0, unsold = 0, permanentUnsold = 0, pending = 0;
  if (historical && round.outcomeSummary) {
    ({ sold, unsold, permanentUnsold } = round.outcomeSummary);
  } else if (!legacy) {
    for (const id of round.playerIds) {
      const status = players.get(id)?.status;
      if (status === 'sold') sold += 1;
      else if (status === 'unsold') unsold += 1;
      else if (status === 'permanent_unsold') permanentUnsold += 1;
      else if (status === 'pending') pending += 1;
    }
  }
  const processed = historical ? total : Math.min(total, sold + unsold + permanentUnsold);
  return { total, sold, unsold, permanentUnsold, pending, processed, legacy,
    percent: total > 0 ? Math.min(100, processed / total * 100) : 0 };
}

export function unsoldPassLabel(round: AuctionRound): string {
  return round.unsoldPass ? `Unsold Round-${round.unsoldPass}` : round.name;
}
