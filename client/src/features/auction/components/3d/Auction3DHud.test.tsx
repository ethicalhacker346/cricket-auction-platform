import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { franchise, makePlayer } from '@/test/auctionFixtures';
import { Auction3DHud, type Auction3DHudProps } from './Auction3DHud';

function props(overrides: Partial<Auction3DHudProps> = {}): Auction3DHudProps {
  return {
    tournamentId: 'tournament-a', auctionId: 'auction-a', player: makePlayer(), players: [makePlayer()], franchises: [franchise],
    leadingFranchise: null, userTeam: null, currentBid: { amount: 0, teamId: null }, timer: { remaining: 30, total: 30, isRunning: true },
    status: 'live', connection: 'connected', latencyMs: 40, viewerCount: 30, currentRound: null, rounds: [], upcomingPlayers: [],
    bidHistory: [], logs: [], soldCount: 0, unsoldCount: 0, totalMoneySpent: 0,
    permissions: { canBid: false, canManageAuction: false, loading: false },
    quality: 'balanced', qualityPreference: 'auto', onQualityChange: vi.fn(), cameraMode: 'broadcast', onCameraModeChange: vi.fn(), onCameraAction: vi.fn(),
    reducedMotion: false, motionPaused: false, onToggleMotion: vi.fn(), followBids: true, onFollowBidsChange: vi.fn(), fps: 54, recoveryMode: false,
    fullscreenTarget: { current: null }, ...overrides,
  };
}
const view = (input: Auction3DHudProps) => render(<MemoryRouter><Auction3DHud {...input} /></MemoryRouter>);

describe('accessible immersive console', () => {
  it('exposes all camera and quality controls in the always-available display panel', async () => {
    const input = props(); view(input);
    fireEvent.click(screen.getByRole('button', { name: 'Arena display settings' }));
    const panel = await screen.findByRole('complementary', { name: 'Your arena settings' });
    expect(within(panel).getAllByRole('radio')).toHaveLength(9);
    fireEvent.click(within(panel).getByRole('radio', { name: /Stage/ }));
    expect(input.onCameraModeChange).toHaveBeenCalledWith('stage');
    fireEvent.click(within(panel).getByRole('radio', { name: /Performance/ }));
    expect(input.onQualityChange).toHaveBeenCalledWith('performance');
    fireEvent.click(within(panel).getByRole('button', { name: 'Rotate camera left' }));
    expect(input.onCameraAction).toHaveBeenCalledWith('left');
    fireEvent.click(within(panel).getByRole('switch', { name: 'Pause arena motion' }));
    expect(input.onToggleMotion).toHaveBeenCalledTimes(1);
    fireEvent.click(within(panel).getByRole('switch', { name: 'Follow new bids with camera' }));
    expect(input.onFollowBidsChange).toHaveBeenCalledWith(false);
    fireEvent.click(within(panel).getByRole('switch', { name: 'Auction sound' }));
    expect(localStorage.getItem('auction_audio_muted')).toBe('true');
  });
  it('closes a panel with Escape and returns focus, without stealing a nested modal’s Escape', async () => {
    view(props());
    const trigger = screen.getByRole('button', { name: 'Arena display settings' }); trigger.focus(); fireEvent.click(trigger);
    await screen.findByRole('complementary', { name: 'Your arena settings' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close panel' }));
    const modal = document.createElement('div'); modal.setAttribute('aria-modal', 'true'); document.body.appendChild(modal);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('complementary', { name: 'Your arena settings' })).toBeTruthy();
    modal.remove(); fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Your arena settings' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it('respects reduced motion and shows a deliberate way out of recovery quality', async () => {
    const input = props({ reducedMotion: true, recoveryMode: true, quality: 'performance' }); view(input);
    fireEvent.click(screen.getByRole('button', { name: 'Arena display settings' }));
    const motion = await screen.findByRole('switch', { name: 'Pause arena motion' });
    expect((motion as HTMLButtonElement).disabled).toBe(true); expect(motion.getAttribute('aria-checked')).toBe('true');
    expect((screen.getByRole('switch', { name: 'Follow new bids with camera' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Resume automatic quality' }));
    expect(input.onQualityChange).toHaveBeenCalledWith('auto');
  });
  it('never exposes organizer controls to guests, but recognizes the explicit extra-time permission', () => {
    const input = props(); const mounted = view(input);
    expect(screen.queryByRole('button', { name: 'Organizer controls' })).toBeNull();
    mounted.rerender(<MemoryRouter><Auction3DHud {...input} permissions={{ ...input.permissions, canExtendLotTime: true }} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Organizer controls' })).toBeTruthy();
  });
  it('bounds a large player queue to 40 rows per page and supports searching later players', async () => {
    const players = Array.from({ length: 503 }, (_, index) => makePlayer({ id: `queued-${index}`, name: `Queued Player ${index}`, status: 'pending' }));
    view(props({ upcomingPlayers: players, players }));
    fireEvent.click(screen.getByRole('button', { name: 'Player queue' }));
    const panel = await screen.findByRole('complementary', { name: 'Auction runway' });
    expect(within(panel).getByText('Queued Player 39')).toBeTruthy(); expect(within(panel).queryByText('Queued Player 40')).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Next queue page' }));
    expect(within(panel).getByText('Queued Player 40')).toBeTruthy(); expect(within(panel).queryByText('Queued Player 0')).toBeNull();
    fireEvent.change(within(panel).getByRole('searchbox'), { target: { value: 'Queued Player 502' } });
    await within(panel).findByText('Queued Player 502');
    expect(within(panel).queryByRole('button', { name: 'Next queue page' })).toBeNull();
  });
});
