import { useEffect } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePlayer, makeSnapshot } from '@/test/auctionFixtures';
import LiveAuction3DPage from './LiveAuction3DPage';

const stage = vi.hoisted(() => ({ mounts: 0, quality: '' }));
vi.mock('../hooks/useAuctionContext', () => ({ useAuctionContext: () => ({ tournamentId: 'tournament-a', auctionId: 'auction-a' }) }));
vi.mock('../hooks/index.hook', () => ({
  useAuth: () => ({ hasHydrated: true }),
  useLiveAuction: () => ({ ...makeSnapshot(), currentPlayer: makePlayer(), leadingFranchise: null, currentRound: null, upcomingPlayers: [] }),
  useResolvedUserTeam: () => ({ franchise: null, permissions: { loading: false, canBid: false, canManageAuction: false } }),
}));
vi.mock('../components/SoldUnsoldAnimation', () => ({ SoldUnsoldAnimation: () => null }));
vi.mock('../components/3d/Auction3DBidDock', () => ({ Auction3DBidDock: () => <section aria-label="Live bidding console">Independent live console</section> }));
vi.mock('../components/3d/AuctionArena3D', () => ({ default: function TestStage({ onRendererReady, onContextLost, onContextRestored, quality }: {
  onRendererReady: () => void; onContextLost: () => void; onContextRestored: () => void; quality: string;
}) {
  stage.quality = quality;
  useEffect(() => { stage.mounts++; onRendererReady(); }, [onRendererReady]);
  return <div data-testid="test-stage"><button onClick={onContextLost}>Simulate graphics loss</button><button onClick={onContextRestored}>Simulate graphics restoration</button></div>;
} }));

beforeEach(() => {
  stage.mounts = 0; stage.quality = '';
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => ({ loseContext: vi.fn() }) } as any);
});
const open = () => render(<MemoryRouter><LiveAuction3DPage /></MemoryRouter>);
describe('3D recovery isolation', () => {
  it('leaves the live console available when the device has no WebGL 2', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    open();
    expect(await screen.findByText('3D acceleration is unavailable')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Live bidding console' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open standard room/ })).toBeTruthy();
    expect(stage.mounts).toBe(0);
  });
  it('lets native restoration recover at safe quality without remounting the room', async () => {
    open(); await screen.findByTestId('test-stage');
    fireEvent.click(screen.getByRole('button', { name: 'Simulate graphics loss' }));
    expect(screen.getByText('Restoring the visual stage…')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Live bidding console' })).toBeTruthy();
    expect(stage.mounts).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Simulate graphics restoration' }));
    expect(screen.queryByText('Restoring the visual stage…')).toBeNull();
    expect(stage.quality).toBe('performance'); expect(stage.mounts).toBe(1);
  });
  it('bounds recovery waiting and only resets the renderer after an explicit retry', async () => {
    open(); await screen.findByTestId('test-stage');
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate graphics loss' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(8100); });
    expect(screen.getByText('The visual stage is paused')).toBeTruthy(); expect(stage.mounts).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Restart visual stage' }));
    expect(stage.mounts).toBe(2); expect(stage.quality).toBe('performance');
    expect(screen.queryByText('The visual stage is paused')).toBeNull();
    expect(screen.getByRole('region', { name: 'Live bidding console' })).toBeTruthy();
  });
});
