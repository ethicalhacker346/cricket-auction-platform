import type { ReactNode } from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { useLiveAuctionStore, useRoleStore } from '../store/index.store';
import { useAuctionPermissions, useResolvedUserTeam } from '../hooks/index.hook';
import { normalizeAuctionPermissions } from '../utils/index.utils';
import { auctionApi } from '../api/index.api';
import { AuctionAccessRoute } from './AuctionAccessRoute';
import { AuctionGuestBanner } from '../components/AuctionGuestBanner';
import { auction, franchise } from '@/test/auctionFixtures';
import type { User } from '@/types/auth';

const user: User = { _id: 'organizer-a', name: 'Organizer', email: 'organizer@example.test', role: 'ORGANIZER', isActive: true, createdAt: '', updatedAt: '' };
const clients: QueryClient[] = [];
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}
function login() { useAuthStore.setState({ user, isAuthenticated: true, accessToken: 'test-only', hasHydrated: true }); }

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null, hasHydrated: true });
  useLiveAuctionStore.setState({ auctionId: auction.id, tournamentId: auction.tournamentId, currentPlayerId: null, status: 'live' });
});
afterEach(() => { clients.forEach((client) => client.clear()); clients.length = 0; });

function renderGuard(access: 'manage' | 'team') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/tournaments/${auction.tournamentId}/auction/${auction.id}/private`]}><Routes>
    <Route path="/tournaments/:tournamentId/auction/:auctionId/private" element={<AuctionAccessRoute access={access}><div>Private console</div></AuctionAccessRoute>} />
    <Route path="/tournaments/:tournamentId/auction/:auctionId/live" element={<div>Public live room</div>} />
  </Routes></MemoryRouter></QueryClientProvider>);
}

describe('public viewing and management boundaries', () => {
  it.each(['manage', 'team'] as const)('redirects a guest away from %s controls without fetching private permissions', async (access) => {
    const request = vi.spyOn(auctionApi, 'getPermissions');
    renderGuard(access);
    expect(await screen.findByText('Public live room')).toBeTruthy();
    expect(screen.queryByText('Private console')).toBeNull(); expect(request).not.toHaveBeenCalled();
  });

  it('does not treat an unrelated organizer role as resource ownership', async () => {
    login(); vi.spyOn(auctionApi, 'getPermissions').mockResolvedValue(normalizeAuctionPermissions({ role: 'ORGANIZER', ownsAuction: false, ownsTournament: false }));
    renderGuard('manage'); expect(await screen.findByText('Public live room')).toBeTruthy();
  });

  it('allows the owning organizer to manage, including after completion for undo', async () => {
    login(); useLiveAuctionStore.setState({ status: 'completed' });
    vi.spyOn(auctionApi, 'getPermissions').mockResolvedValue(normalizeAuctionPermissions({ role: 'ORGANIZER', ownsAuction: true, ownsTournament: true, permissions: { UNDO_ACTION: true } }));
    renderGuard('manage'); expect(await screen.findByText('Private console')).toBeTruthy();
  });

  it('deduplicates permission reads across surfaces and revokes cached controls immediately on logout', async () => {
    login();
    const request = vi.spyOn(auctionApi, 'getPermissions').mockResolvedValue(normalizeAuctionPermissions({ role: 'ORGANIZER', ownsAuction: true, permissions: { UNDO_ACTION: true, MANAGE_AUCTION: true } }));
    const { result } = renderHook(() => [useAuctionPermissions(auction.id), useAuctionPermissions(auction.id)], { wrapper });
    await waitFor(() => expect(result.current[0].canUndo).toBe(true)); expect(request).toHaveBeenCalledTimes(1);
    act(() => useAuthStore.getState().clearAuth());
    expect(result.current.every((permission) => !permission.canUndo && !permission.canBid && !permission.canManageAuction)).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not assign a guest or unrelated signed-in player the previous owner’s cached team', async () => {
    useRoleStore.setState({ userTeamId: franchise.id });
    const { result } = renderHook(() => useResolvedUserTeam([franchise]), { wrapper });
    expect(result.current.resolvedId).toBeNull(); expect(result.current.isLoading).toBe(false);
    vi.spyOn(auctionApi, 'getPermissions').mockResolvedValue(normalizeAuctionPermissions({ role: 'PLAYER' }));
    act(() => useAuthStore.setState({ user: { ...user, role: 'PLAYER' }, isAuthenticated: true, accessToken: 'test-only' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.franchise).toBeNull();
  });

  it('resolves the approved owning franchise with only the canonical user _id', async () => {
    useLiveAuctionStore.setState({ currentPlayerId: 'player-a' });
    useAuthStore.setState({ user: { ...user, role: 'FRANCHISE_OWNER' }, isAuthenticated: true, accessToken: 'test-only' });
    vi.spyOn(auctionApi, 'getPermissions').mockResolvedValue(normalizeAuctionPermissions({ role: 'FRANCHISE_OWNER', ownsTournamentTeam: true, tournamentTeamApproved: true, tournamentTeamId: franchise.id, permissions: { PLACE_BID: true } }));
    const { result } = renderHook(() => useResolvedUserTeam([franchise]), { wrapper });
    await waitFor(() => expect(result.current.franchise?.id).toBe(franchise.id));
    expect(result.current.permissions.canBid).toBe(true);
  });

  it('labels guests honestly and provides sign-in and a public watch-link action', () => {
    render(<MemoryRouter><AuctionGuestBanner tournamentId={auction.tournamentId} auctionId={auction.id} /></MemoryRouter>);
    expect(screen.getByText('Guest view · read-only.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in to participate' }).getAttribute('href')).toBe('/login');
    expect(screen.getByRole('button', { name: 'Share watch link' })).toBeTruthy();
  });
});
