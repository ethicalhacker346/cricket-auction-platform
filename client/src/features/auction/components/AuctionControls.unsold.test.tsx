import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auction, franchise, makePlayer, makeSnapshot } from '@/test/auctionFixtures';
import type { AuctionRound } from '../types/index.types';
import { normalizeAuctionPermissions } from '../utils/index.utils';
import { AuctionControls } from './AuctionControls';

const state = vi.hoisted(() => ({ live: {} as Record<string, unknown>, permissions: {} as Record<string, unknown> }));
vi.mock('../hooks/index.hook', () => ({ useLiveAuction: () => state.live, useAuctionPermissions: () => state.permissions }));
const round: AuctionRound = { id: 'unsold-1', auctionId: auction.id, name: 'Unsold Round-1', unsoldPass: 1,
  type: 'unsold', category: 'UNSOLD', order: 3, status: 'active', playerIds: ['player-a', 'deferred', 'waiting'] };
const player = makePlayer({ auctionRoundId: round.id });
const actions = {
  start: vi.fn(), pause: vi.fn(), resume: vi.fn(), complete: vi.fn(), openNextLot: vi.fn(),
  forceSold: vi.fn(), forceUnsold: vi.fn(), markPermanentUnsold: vi.fn(), advanceUnsoldPass: vi.fn(),
  extendLotTime: vi.fn(), undo: vi.fn(),
};
const target = { tournamentPlayerId: player.id, roundId: round.id, expectedVersion: 7 };
beforeEach(() => {
  for (const action of Object.values(actions)) action.mockResolvedValue({ success: true });
  state.live = { ...makeSnapshot(), auction, version: 7, actions, connection: 'connected', currentPlayer: player, currentPlayerId: player.id,
    currentRound: round, currentRoundId: round.id, rounds: [round], leadingFranchise: franchise, currentBid: { amount: 100, teamId: franchise.id },
    players: [player, makePlayer({ id: 'deferred', status: 'unsold', auctionRoundId: round.id }), makePlayer({ id: 'waiting', status: 'pending', auctionRoundId: round.id })],
  };
  state.permissions = { ...normalizeAuctionPermissions({ permissions: { SETTLE_LOT: true, MARK_PERMANENT_UNSOLD: true, OPEN_LOT: true } }), loading: false };
});

describe('explicit unsold-pass organizer choices', () => {
  it('shows both labelled choices and defers without permanently retiring the active player', async () => {
    render(<AuctionControls />);
    expect(screen.getByRole('button', { name: 'Force Unsold' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Permanent Unsold' })).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Force Unsold' }));
    expect(screen.getByRole('dialog').textContent).toContain('does not permanently retire');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Unsold' }));
    await waitFor(() => expect(actions.forceUnsold).toHaveBeenCalledWith(target));
    expect(actions.markPermanentUnsold).not.toHaveBeenCalled();
  });

  it('requires an explicit permanent confirmation and submits the reviewed player/pass/revision', async () => {
    render(<AuctionControls />);
    fireEvent.click(screen.getByRole('button', { name: 'Permanent Unsold' }));
    expect(actions.markPermanentUnsold).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toContain('excluded from every later unsold pass');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Permanent Unsold' }));
    await waitFor(() => expect(actions.markPermanentUnsold).toHaveBeenCalledWith(player.id, target));
    expect(actions.forceUnsold).not.toHaveBeenCalled();
  });

  it('does not offer permanent retirement in a normal round', () => {
    state.live = { ...state.live, currentRound: { ...round, type: 'normal', unsoldPass: undefined }, rounds: [{ ...round, type: 'normal', unsoldPass: undefined }] };
    render(<AuctionControls />);
    expect(screen.getByRole('button', { name: 'Force Unsold' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Permanent Unsold' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Unsold pass progress' })).toBeNull();
  });

  it.each(['version', 'round', 'connection'] as const)('invalidates a reviewed confirmation when the %s changes, even if the player name stays identical', (change) => {
    const { rerender } = render(<AuctionControls />);
    fireEvent.click(screen.getByRole('button', { name: 'Force Unsold' }));
    state.live = { ...state.live, ...(change === 'version' ? { version: 8 } : change === 'connection' ? { connection: 'offline' } : { currentRoundId: 'unsold-2', currentRound: { ...round, id: 'unsold-2', unsoldPass: 2 } }) };
    rerender(<AuctionControls />);
    expect(screen.getByRole('alert').textContent).toContain('player, pass or bid changed');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Confirm Unsold' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Unsold' }));
    expect(actions.forceUnsold).not.toHaveBeenCalled();
  });

  it('keeps guests and unrelated accounts read-only', () => {
    state.permissions = { ...normalizeAuctionPermissions({}), loading: false };
    render(<AuctionControls />);
    expect(screen.getByText(/Read-only spectator view/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Force Unsold' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Permanent Unsold' })).toBeNull();
  });

  it('disables settlement while disconnected and supports the separate permanent capability while paused', async () => {
    state.live = { ...state.live, connection: 'offline' };
    const { rerender } = render(<AuctionControls />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Force Unsold' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Permanent Unsold' }).disabled).toBe(true);
    state.live = { ...state.live, connection: 'connected', auction: { ...auction, status: 'paused' } };
    state.permissions = { ...state.permissions, canMarkUnsold: false, canMarkSold: false };
    rerender(<AuctionControls />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Force Unsold' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Permanent Unsold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Permanent Unsold' }));
    await waitFor(() => expect(actions.markPermanentUnsold).toHaveBeenCalledWith(player.id, target));
    expect(actions.resume).not.toHaveBeenCalled();
  });

  it('repairs a legacy exhausted pass only on an explicit Continue action, never on render', async () => {
    state.live = { ...state.live, currentPlayer: null, currentPlayerId: null, players: [player, ...((state.live.players as typeof player[]).slice(1))].map((p) => ({ ...p, status: 'unsold' })) };
    render(<AuctionControls />);
    const button = screen.getByRole('button', { name: 'Continue unsold passes' });
    expect(actions.advanceUnsoldPass).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(actions.advanceUnsoldPass).toHaveBeenCalledWith(round.id));
    expect(actions.openNextLot).not.toHaveBeenCalled();
  });
});
