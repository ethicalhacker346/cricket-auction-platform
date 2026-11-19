import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auction, franchise, makePlayer, makeSnapshot } from '@/test/auctionFixtures';
import { auctionApi, bidApi, liveAuctionApi } from '../api/index.api';
import { auctionEventBus } from '../audio/EventBus';
import { AuctionEngine } from './AuctionEngine';
import type { AuctionSnapshot, LotTimeResponse } from '../types/index.types';

type FakeSocket = {
  handlers: Map<string, Array<(payload?: any) => void>>;
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};
const transport = vi.hoisted(() => ({ sockets: [] as FakeSocket[] }));
vi.mock('socket.io-client', () => ({ io: vi.fn(() => {
  const socket: FakeSocket = {
    handlers: new Map(),
    on: vi.fn((event, handler) => {
      socket.handlers.set(event, [...(socket.handlers.get(event) ?? []), handler]);
      if (event === 'connect') queueMicrotask(handler);
      return socket;
    }),
    emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn(),
  };
  transport.sockets.push(socket);
  return socket;
}) }));

function deferred<T>() {
  let resolve!: (result: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const rawLive = (version: number, playerId: string | null = 'player-a') => ({
  currentTournamentPlayerId: playerId, currentRoundId: 'round-a', currentHighestBid: 0,
  highestBidderTeamId: null, remainingTimeSeconds: 12, lotStatus: playerId ? 'BIDDING' : 'PENDING', version,
});
const correction = (version: number) => ({
  auctionId: auction.id, version, liveState: rawLive(version), action: null,
  auction: { ...auction, _id: auction.id, status: 'PAUSED', liveState: rawLive(version) },
});
const flush = () => vi.advanceTimersByTimeAsync(0);
const send = (name: string, payload?: any, socket = transport.sockets.at(-1)!) => {
  socket.handlers.get(name)?.forEach((listener) => listener(payload));
};
let engine: AuctionEngine;

beforeEach(() => { vi.useFakeTimers(); transport.sockets.length = 0; engine = new AuctionEngine(); });
afterEach(() => engine.destroy());

describe('undo and late-frame reconciliation', () => {
  it('keeps completed rooms subscribed and adopts an organizer undo as a paused, silent lot', async () => {
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot({
      version: 10, status: 'completed', auction: { ...auction, status: 'completed' }, currentPlayerId: null,
      players: [makePlayer({ status: 'sold', teamId: franchise.id })],
    }));
    await engine.connect(auction.id, auction.tournamentId);
    expect(transport.sockets).toHaveLength(1);
    expect(engine.isConnected()).toBe(true);
    const audio = vi.spyOn(auctionEventBus, 'emit'); audio.mockClear();
    fetch.mockResolvedValue(makeSnapshot({ version: 11, undoVersion: 11, status: 'paused', auction: { ...auction, status: 'paused' }, timer: { remaining: 12, total: 30, isRunning: false } }));
    send('auction:action:undone', correction(11)); await flush();
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', currentPlayerId: 'player-a', undoVersion: 11, soldEvent: null, unsoldEvent: null, timer: { isRunning: false } });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(engine.getSnapshot().timer.remaining).toBe(12);
    expect(audio).not.toHaveBeenCalled();
  });

  it('does not reinterpret restored unsold players or completed rounds as new verdicts/sounds', async () => {
    const round = { id: 'round-a', auctionId: auction.id, name: 'Normal', order: 1, category: 'CUSTOM' as const, type: 'normal' as const, status: 'completed' as const, playerIds: ['player-a', 'player-b'] };
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot({ version: 4, players: [makePlayer({ status: 'pending' }), makePlayer({ id: 'player-b', status: 'pending' })], rounds: [round] }));
    await engine.connect(auction.id, auction.tournamentId);
    const audio = vi.spyOn(auctionEventBus, 'emit'); audio.mockClear();
    fetch.mockResolvedValue(makeSnapshot({ version: 5, undoVersion: 5, status: 'paused', auction: { ...auction, status: 'paused' }, players: [makePlayer({ status: 'unsold' }), makePlayer({ id: 'player-b', status: 'current' })], rounds: [round], currentPlayerId: 'player-b', timer: { remaining: 12, total: 30, isRunning: false } }));
    send('auction:action:undone', correction(5)); await flush();
    expect(engine.getSnapshot().unsoldEvent).toBeNull();
    expect(audio).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(audio).not.toHaveBeenCalled();
  });

  it('still celebrates a genuinely re-completed round after an undo reopens it', async () => {
    const round = { id: 'round-a', auctionId: auction.id, name: 'Normal', order: 1, category: 'CUSTOM' as const, type: 'normal' as const, status: 'completed' as const, playerIds: ['player-a'] };
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot({ version: 4, rounds: [round] }));
    await engine.connect(auction.id, auction.tournamentId);
    const audio = vi.spyOn(auctionEventBus, 'emit'); audio.mockClear();
    fetch.mockResolvedValue(makeSnapshot({ version: 5, undoVersion: 5, rounds: [{ ...round, status: 'active' }], status: 'paused', auction: { ...auction, status: 'paused' } }));
    send('auction:action:undone', correction(5)); await flush();
    expect(audio).not.toHaveBeenCalled();
    send('auction:round:completed', { auctionId: auction.id, version: 7, roundId: round.id, round: { ...round, _id: round.id, status: 'COMPLETED' } });
    expect(audio.mock.calls.filter(([event]) => event.type === 'ROUND_COMPLETED')).toHaveLength(1);
  });

  it('rejects every older bid/lot/round/timer frame after an undo revision', async () => {
    const round = { id: 'round-a', auctionId: auction.id, name: 'Current round', order: 1, category: 'CUSTOM' as const, type: 'normal' as const, status: 'active' as const, playerIds: ['player-a'] };
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot({ version: 8, rounds: [round] }));
    await engine.connect(auction.id, auction.tournamentId);
    fetch.mockResolvedValue(makeSnapshot({ version: 10, undoVersion: 10, status: 'paused', auction: { ...auction, status: 'paused' }, rounds: [round], timer: { remaining: 12, total: 30, isRunning: false } }));
    send('auction:action:undone', correction(10)); await flush();
    const before = engine.getSnapshot();
    const old = { auctionId: auction.id, version: 9, liveState: rawLive(9), tournamentPlayerId: 'player-a', roundId: 'round-a', round: { _id: 'round-a', status: 'COMPLETED' }, amount: 999, remaining: 0, action: { id: 'wrong-head' } };
    for (const event of ['auction:bid:placed', 'auction:lot:sold', 'auction:lot:unsold', 'auction:lot:permanent_unsold', 'auction:round:added', 'auction:round:updated', 'auction:round:completed', 'auction:round:deleted', 'auction:timer:sync', 'auction:timer:stopped', 'auction:timer:expired', 'auction:action:recorded', 'auction:lot:time:extended', 'auction:completed']) send(event, old);
    expect(engine.getSnapshot()).toEqual(before);
  });

  it('ignores a REST snapshot that started before a newer socket action', async () => {
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot({ version: 1 }));
    await engine.connect(auction.id, auction.tournamentId);
    const late = deferred<AuctionSnapshot>(); fetch.mockReturnValueOnce(late.promise);
    await vi.advanceTimersByTimeAsync(10_000);
    send('auction:bid:placed', { auctionId: auction.id, version: 3, amount: 300, teamId: franchise.id, liveState: { ...rawLive(3), currentHighestBid: 300, highestBidderTeamId: franchise.id } });
    late.resolve(makeSnapshot({ version: 2, currentBid: { amount: 100, teamId: franchise.id } })); await flush();
    expect(engine.getSnapshot().currentBid.amount).toBe(300);
  });

  it('REST-only recovery discovers a missed undo without replaying historical verdicts', async () => {
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot({ version: 4, players: [makePlayer({ status: 'pending' })] }));
    await engine.connect(auction.id, auction.tournamentId);
    fetch.mockResolvedValue(makeSnapshot({ version: 6, undoVersion: 5, players: [makePlayer({ status: 'unsold' })] }));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(engine.getSnapshot().undoVersion).toBe(5);
    expect(engine.getSnapshot().unsoldEvent).toBeNull();
  });

  it('does not let a delayed HTTP undo acknowledgement erase a newer real sale', async () => {
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot({ version: 1 }));
    await engine.connect(auction.id, auction.tournamentId);
    const pending = deferred<any>(); vi.spyOn(auctionApi, 'undoAction').mockReturnValue(pending.promise);
    const request = engine.undo('confirmed-action');
    fetch.mockResolvedValue(makeSnapshot({ version: 2, undoVersion: 2, status: 'paused', auction: { ...auction, status: 'paused' } }));
    send('auction:action:undone', correction(2)); await flush();
    send('auction:lot:sold', { auctionId: auction.id, version: 4, tournamentPlayerId: 'player-a', soldToTeamId: franchise.id, soldPrice: 500, liveState: rawLive(4, null) });
    const verdict = engine.getSnapshot().soldEvent;
    expect(verdict).not.toBeNull();
    fetch.mockResolvedValue(makeSnapshot({ version: 4, undoVersion: 2, players: [makePlayer({ status: 'sold', teamId: franchise.id, soldPrice: 500 })], currentPlayerId: null }));
    pending.resolve(correction(2)); await request;
    expect(engine.getSnapshot().soldEvent).toEqual(verdict);
  });
});

describe('connection and command ownership', () => {
  it('ignores the resolution of a different auction’s initial snapshot', async () => {
    const old = deferred<AuctionSnapshot>();
    vi.spyOn(auctionApi, 'getSnapshot').mockReturnValueOnce(old.promise).mockResolvedValue(makeSnapshot({ auction: { ...auction, id: 'auction-b' } }));
    const connecting = engine.connect(auction.id, auction.tournamentId);
    await engine.connect('auction-b', auction.tournamentId);
    old.resolve(makeSnapshot()); await connecting;
    expect(engine.getSnapshot().auction.id).toBe('auction-b');
    expect(transport.sockets).toHaveLength(1);
  });

  it('ignores the rejection of a stale snapshot rather than marking the new room offline', async () => {
    const old = deferred<AuctionSnapshot>();
    vi.spyOn(auctionApi, 'getSnapshot').mockReturnValueOnce(old.promise).mockResolvedValue(makeSnapshot({ auction: { ...auction, id: 'auction-b' } }));
    const connecting = engine.connect(auction.id, auction.tournamentId);
    await engine.connect('auction-b', auction.tournamentId);
    old.reject(new Error('Old network failed')); await connecting;
    expect(engine.getSnapshot().connection).toBe('connected');
  });

  it('never reapplies an old bid response into a different auction', async () => {
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot());
    await engine.connect(auction.id, auction.tournamentId);
    const pending = deferred<any>(); vi.spyOn(bidApi, 'placeBid').mockReturnValue(pending.promise);
    const bidding = engine.placeBid(franchise.id, 100);
    fetch.mockResolvedValue(makeSnapshot({ auction: { ...auction, id: 'auction-b' }, currentBid: { amount: 0, teamId: null } }));
    await engine.connect('auction-b', auction.tournamentId);
    pending.resolve({ id: 'old-bid', amount: 100, teamId: franchise.id, playerId: 'player-a' }); await bidding;
    expect(engine.getSnapshot().auction.id).toBe('auction-b');
    expect(engine.getSnapshot().currentBid.amount).toBe(0);
    expect(engine.getSnapshot().bidHistory).toHaveLength(0);
  });

  it('keeps completion observable even when this tab issues Complete', async () => {
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot());
    await engine.connect(auction.id, auction.tournamentId);
    vi.spyOn(auctionApi, 'completeAuction').mockResolvedValue({ ...auction, status: 'completed' });
    fetch.mockResolvedValue(makeSnapshot({ version: 2, auction: { ...auction, status: 'completed' }, status: 'completed' }));
    await expect(engine.complete()).resolves.toEqual({ success: true });
    expect(engine.isConnected()).toBe(true);
    expect(transport.sockets[0].disconnect).not.toHaveBeenCalled();
  });

  it('rejoins and refreshes on Socket.IO’s actual reconnect signal (connect)', async () => {
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot());
    await engine.connect(auction.id, auction.tournamentId);
    send('disconnect', 'transport close');
    expect(engine.getSnapshot().connection).toBe('reconnecting');
    send('connect'); await flush();
    expect(engine.getSnapshot().connection).toBe('connected');
    expect(transport.sockets[0].emit.mock.calls.filter(([name]) => name === 'auction:join')).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('opens the explicit eligible selection in the running round, not the original first player', async () => {
    const round = { id: 'round-a', auctionId: auction.id, name: 'Round', order: 1, category: 'CUSTOM' as const, type: 'normal' as const, status: 'active' as const, playerIds: ['player-a', 'player-b'] };
    vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot({ rounds: [round], currentPlayerId: null, players: [makePlayer({ status: 'pending' }), makePlayer({ id: 'player-b', status: 'pending' })] }));
    const open = vi.spyOn(liveAuctionApi, 'openLot').mockResolvedValue({});
    await engine.connect(auction.id, auction.tournamentId);
    await expect(engine.openNextLot('player-b')).resolves.toEqual({ success: true });
    expect(open).toHaveBeenCalledWith(auction.id, 'player-b', 'round-a');
    await expect(engine.openNextLot('not-in-round')).resolves.toMatchObject({ success: false });
    expect(open).toHaveBeenCalledTimes(1);
  });
});

const extendedClock = (version = 2, status = 'LIVE', remaining = 30): LotTimeResponse => ({
  status, liveState: { ...rawLive(version), timerTotalSeconds: 60, updatedAt: new Date().toISOString() },
  timer: { remaining, total: 60, isRunning: status === 'LIVE' && remaining > 0 },
});
const refresh = () => (engine as unknown as { refreshSnapshot: () => Promise<boolean> }).refreshSnapshot();

describe('bounded live traffic and authoritative lot-time commands', () => {
  it('coalesces concurrent refreshes into one request and at most one trailing reconciliation', async () => {
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot());
    await engine.connect(auction.id, auction.tournamentId);
    const pending = deferred<AuctionSnapshot>(); fetch.mockReturnValueOnce(pending.promise);
    const calls = Array.from({ length: 20 }, refresh);
    expect(fetch).toHaveBeenCalledTimes(2);
    pending.resolve(makeSnapshot({ version: 2 })); await Promise.all(calls);
    await vi.advanceTimersByTimeAsync(100);
    expect(fetch).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(500);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('honors Retry-After without disconnecting a healthy socket or delaying a live extension frame', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot());
    await engine.connect(auction.id, auction.tournamentId);
    Object.assign(transport.sockets[0], { connected: true });
    fetch.mockRejectedValueOnce(Object.assign(new Error('Rate limited'), { status: 429, retryAfterMs: 60_000 }));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(engine.getSnapshot().connection).toBe('connected');
    send('auction:lot:time:extended', { auctionId: auction.id, version: 2, status: 'LIVE', seconds: 30,
      liveState: { ...rawLive(2), remainingTimeSeconds: 30, timerTotalSeconds: 60 } });
    expect(engine.getSnapshot().timer).toEqual({ remaining: 30, total: 60, isRunning: true });
    await Promise.all(Array.from({ length: 20 }, refresh));
    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetch).toHaveBeenCalledTimes(2);
    fetch.mockResolvedValue(makeSnapshot({ version: 2 }));
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('adopts the successful HTTP clock immediately even while read reconciliation is backed off', async () => {
    vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot({ timer: { remaining: 0, total: 30, isRunning: false } }));
    await engine.connect(auction.id, auction.tournamentId);
    const extend = vi.spyOn(auctionApi, 'extendLotTime').mockResolvedValue(extendedClock());
    const requestId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
    await expect(engine.extendLotTime('player-a', 30, requestId)).resolves.toEqual({ success: true });
    expect(extend).toHaveBeenCalledExactlyOnceWith(auction.id, 'player-a', 30, requestId);
    expect(engine.getSnapshot().timer).toEqual({ remaining: 30, total: 60, isRunning: true });
  });

  it('keeps a paused extension paused, and never reopens an expired deduplicated HTTP response', async () => {
    vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot());
    await engine.connect(auction.id, auction.tournamentId);
    const extend = vi.spyOn(auctionApi, 'extendLotTime').mockResolvedValueOnce(extendedClock(2, 'PAUSED', 45)).mockResolvedValueOnce(extendedClock(3, 'LIVE', 0));
    await engine.extendLotTime('player-a', 45);
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', timer: { remaining: 45, total: 60, isRunning: false } });
    await engine.extendLotTime('player-a', 30);
    expect(engine.getSnapshot().timer).toEqual({ remaining: 0, total: 60, isRunning: false });
    expect(extend).toHaveBeenCalledTimes(2);
  });

  it('does not replay a failed extension, and distinguishes a definitive refusal from an uncertain timeout', async () => {
    vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot());
    await engine.connect(auction.id, auction.tournamentId);
    const extend = vi.spyOn(auctionApi, 'extendLotTime').mockRejectedValueOnce(Object.assign(new Error('Timed out'), { status: 408 })).mockRejectedValueOnce(Object.assign(new Error('Not permitted'), { status: 403 }));
    await expect(engine.extendLotTime('player-a', 30)).resolves.toMatchObject({ success: false, uncertain: true });
    await vi.advanceTimersByTimeAsync(1000); expect(extend).toHaveBeenCalledTimes(1);
    await expect(engine.extendLotTime('player-a', 30)).resolves.toMatchObject({ success: false, uncertain: false });
    await expect(engine.extendLotTime('previous-player', 30)).resolves.toMatchObject({ success: false });
    expect(extend).toHaveBeenCalledTimes(2);
  });

  it('fences an extension response by auction generation and newer live revisions', async () => {
    const fetch = vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot());
    await engine.connect(auction.id, auction.tournamentId);
    const pending = deferred<LotTimeResponse>(); vi.spyOn(auctionApi, 'extendLotTime').mockReturnValue(pending.promise);
    const adding = engine.extendLotTime('player-a', 30);
    fetch.mockResolvedValue(makeSnapshot({ auction: { ...auction, id: 'auction-b' }, timer: { remaining: 9, total: 30, isRunning: false } }));
    await engine.connect('auction-b', auction.tournamentId);
    pending.resolve(extendedClock(20)); await adding;
    expect(engine.getSnapshot().auction.id).toBe('auction-b'); expect(engine.getSnapshot().timer.remaining).toBe(9);
  });

  it('uses an acknowledged socket heartbeat, with exactly one REST fallback after failure', async () => {
    vi.spyOn(auctionApi, 'getSnapshot').mockResolvedValue(makeSnapshot());
    const rest = vi.spyOn(auctionApi, 'heartbeatViewer').mockResolvedValue({ viewerCount: 3 });
    await engine.connect(auction.id, auction.tournamentId);
    const socket = transport.sockets[0];
    const join = socket.emit.mock.calls.find(([event]) => event === 'auction:join')!;
    join[2]({ success: true, data: { viewerCount: 2 } });
    const acknowledge = vi.fn((_event, _payload, ack) => ack(null, { success: true, data: { viewerCount: 5 } }));
    Object.assign(socket, { connected: true, timeout: () => ({ emit: acknowledge }) });
    await expect(engine.heartbeatViewer(auction.id, 'tab-viewer')).resolves.toEqual({ viewerCount: 5 });
    expect(rest).not.toHaveBeenCalled();
    acknowledge.mockImplementation((_event, _payload, ack) => ack(new Error('Transport stalled')));
    await expect(engine.heartbeatViewer(auction.id, 'tab-viewer')).resolves.toEqual({ viewerCount: 3 });
    expect(rest).toHaveBeenCalledTimes(1);
  });
});
