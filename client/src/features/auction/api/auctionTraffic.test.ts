import { afterEach, describe, expect, it, vi } from 'vitest';
import { auctionApi, AuctionApiError, liveAuctionApi } from './index.api';
import { normalizeAuctionPermissions, withLiveStateConstraints } from '../utils/index.utils';

afterEach(() => vi.unstubAllGlobals());
describe('auction HTTP boundary', () => {
  it('preserves structured 429 errors and Retry-After without replaying a mutation', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, code: 'RATE_LIMITED', message: 'Please wait', retryAfter: 3 }), { status: 429, headers: { 'Retry-After': '7' } }));
    vi.stubGlobal('fetch', fetch);
    const error = await auctionApi.extendLotTime('auction', 'player', 30, 'request-id').catch((error) => error);
    expect(error).toBeInstanceOf(AuctionApiError);
    expect(error).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfterMs: 7000 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ tournamentPlayerId: 'player', seconds: 30, requestId: 'request-id' });
  });
  it('uses the JSON Retry-After fallback when a proxy omits the header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ retryAfter: 12 }), { status: 429 })));
    await expect(auctionApi.getById('auction')).rejects.toMatchObject({ status: 429, retryAfterMs: 12_000 });
  });
  it('bounds stalled requests and reports an uncertain outcome, with no automatic replay', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    vi.stubGlobal('fetch', fetch);
    const result = auctionApi.extendLotTime('auction', 'player', 30, 'request-id').catch((error) => error);
    await vi.advanceTimersByTimeAsync(15_001);
    expect(await result).toMatchObject({ status: 408, code: 'REQUEST_TIMEOUT' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('serializes reviewed player, pass and revision for every settlement without trusting team IDs', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: {} }))));
    vi.stubGlobal('fetch', fetch);
    const target = { tournamentPlayerId: 'player', roundId: 'pass-3', expectedVersion: 21 };
    await liveAuctionApi.markSold('auction', target);
    await liveAuctionApi.markUnsold('auction', target);
    await liveAuctionApi.markPermanentUnsold('auction', 'player', { roundId: target.roundId, expectedVersion: target.expectedVersion });
    await liveAuctionApi.advanceUnsoldPass('auction', 'pass-3', 21);
    expect(fetch.mock.calls.map(([, options]) => JSON.parse(options.body))).toEqual([
      target, target, { roundId: 'pass-3', expectedVersion: 21 }, { expectedVersion: 21 },
    ]);
    expect(fetch.mock.calls[2][0]).toContain('/players/player/permanent-unsold');
    expect(fetch.mock.calls[3][0]).toContain('/rounds/pass-3/advance');
  });
  it('fails closed for the new permission, and hides it when no player is active', () => {
    expect(normalizeAuctionPermissions({ role: 'ORGANIZER' }).canExtendLotTime).toBe(false);
    const access = normalizeAuctionPermissions({ permissions: { EXTEND_LOT_TIME: true }, canExtendLotTime: false });
    expect(access.canExtendLotTime).toBe(true);
    expect(withLiveStateConstraints(access, false).canExtendLotTime).toBe(false);
    expect(withLiveStateConstraints(access, true).canExtendLotTime).toBe(true);
  });
});
