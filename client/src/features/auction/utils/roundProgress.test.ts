import { describe, expect, it } from 'vitest';
import { makePlayer } from '@/test/auctionFixtures';
import type { AuctionRound } from '../types/index.types';
import { roundProgress, unsoldPassLabel } from './roundProgress';

const round: AuctionRound = { id: 'pass-1', auctionId: 'auction-a', name: 'Unsold Round-1', unsoldPass: 1,
  type: 'unsold', category: 'UNSOLD', order: 3, status: 'active', playerIds: ['player-a', 'player-b', 'player-c'] };
const pool = (...statuses: Array<'pending' | 'current' | 'sold' | 'unsold' | 'permanent_unsold'>) => new Map(statuses.map((status, index) => {
  const player = makePlayer({ id: `player-${String.fromCharCode(97 + index)}`, status }); return [player.id, player];
}));

describe('historical pass progress', () => {
  it('counts deferral as processed for this pass, not as auction resolution', () => {
    expect(roundProgress(round, pool('unsold', 'current', 'pending'))).toMatchObject({ processed: 1, total: 3, unsold: 1, pending: 1 });
  });
  it('never rewrites completed pass results when the same players are reset or sold later', () => {
    const completed = { ...round, status: 'completed' as const, outcomeSummary: { sold: 0, unsold: 2, permanentUnsold: 1 } };
    expect(roundProgress(completed, pool('pending', 'sold', 'permanent_unsold'))).toMatchObject({ processed: 3, percent: 100, sold: 0, unsold: 2, permanentUnsold: 1, pending: 0 });
  });
  it('does not invent historical outcome totals for legacy completed rounds', () => {
    expect(roundProgress({ ...round, status: 'completed' }, pool('pending', 'sold', 'sold'))).toMatchObject({ legacy: true, processed: 3, percent: 100, sold: 0, unsold: 0, pending: 0 });
  });
  it('handles empty/missing members without NaN or overflow', () => {
    expect(roundProgress({ ...round, playerIds: [] }, new Map()).percent).toBe(0);
    expect(roundProgress(round, new Map()).processed).toBe(0);
  });
  it('labels passes independently of overall display order and supports legacy names', () => {
    expect(unsoldPassLabel(round)).toBe('Unsold Round-1');
    expect(unsoldPassLabel({ ...round, order: 99, unsoldPass: 3 })).toBe('Unsold Round-3');
    expect(unsoldPassLabel({ ...round, unsoldPass: undefined, name: 'Legacy Unsold Players Round' })).toBe('Legacy Unsold Players Round');
  });
});
