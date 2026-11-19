import { jest } from '@jest/globals';
import SocketEventPublisher from '../src/publishers/socket.publisher.js';
import eventBus from '../src/events/eventBus.js';
import { AUCTION_EVENTS, emitActionRecorded, emitActionUndone, emitRoundAdded, withAuctionEventVersion } from '../src/events/auction.events.js';

let publisher;
let frames;
const auctionId = 'auction-test';
const live = (version, remaining = 30) => ({ version, lotStatus: 'BIDDING', remainingTimeSeconds: remaining, updatedAt: new Date() });
const send = (event, payload) => eventBus.safeEmit(event, { auctionId, ...payload });

beforeEach(() => {
  jest.useFakeTimers();
  frames = [];
  const io = { to: (room) => ({ emit: (event, payload) => frames.push({ room, event, payload }) }), emit: jest.fn() };
  publisher = new SocketEventPublisher(io); publisher.init();
});
afterEach(() => { publisher.shutdown(); jest.useRealTimers(); });

const last = (event) => frames.filter((frame) => frame.event === event).at(-1)?.payload;

test('undo stops a running timer and never broadcasts phantom expiry for a recovered paused lot', () => {
  send(AUCTION_EVENTS.LOT_OPENED, { liveState: live(2) });
  emitActionUndone(auctionId, { version: 3, auction: { status: 'PAUSED' }, liveState: live(3, 12) });
  expect(publisher.activeTimers.size).toBe(0);
  expect(last('auction:action:undone').version).toBe(3);
  const count = frames.length;
  jest.advanceTimersByTime(60_000);
  expect(frames).toHaveLength(count);
});

test('undo of Pause restores a timer from the authoritative persisted remainder, including event delay', () => {
  const state = live(5, 15);
  jest.advanceTimersByTime(2_000);
  emitActionUndone(auctionId, { version: 5, auction: { status: 'LIVE', lotTimerSeconds: 30 }, liveState: state });
  expect(last('auction:timer:sync')).toMatchObject({ version: 5, remaining: 13, total: 30 });
  jest.advanceTimersByTime(13_000);
  expect(last('auction:timer:expired').version).toBe(5);
  expect(publisher.activeTimers.size).toBe(0);
});

test('round edits carry the command revision and re-anchor, rather than extend, an active clock', async () => {
  const state = live(2, 30);
  send(AUCTION_EVENTS.LOT_OPENED, { liveState: state });
  jest.advanceTimersByTime(3_000);
  await withAuctionEventVersion(auctionId, 3, async () => {
    emitRoundAdded(auctionId, { round: { _id: 'new-round' } });
    emitActionRecorded(auctionId, { version: 3, status: 'LIVE', liveState: { ...state, version: 3 }, lotTimerSeconds: 30 });
  });
  expect(last('auction:round:added').version).toBe(3);
  expect(last('auction:timer:sync')).toMatchObject({ version: 3, remaining: 27 });
  expect(publisher.activeTimers.size).toBe(1);
});

test('late post-commit events cannot replace the timer or head after a newer correction', () => {
  emitActionUndone(auctionId, { version: 10, auction: { status: 'PAUSED' }, liveState: live(10) });
  const before = frames.length;
  send(AUCTION_EVENTS.LOT_OPENED, { version: 9, liveState: live(9) });
  emitActionRecorded(auctionId, { version: 9, status: 'LIVE', liveState: live(9), action: { id: 'stale' } });
  expect(frames).toHaveLength(before);
  expect(publisher.activeTimers.size).toBe(0);
});

test('resuming without an existing in-memory timer publishes status before starting a replacement', () => {
  send(AUCTION_EVENTS.AUCTION_RESUMED, { auction: { status: 'LIVE', liveState: live(6), lotTimerSeconds: 30 } });
  expect(publisher.activeTimers.size).toBe(1);
  expect(frames.findIndex((frame) => frame.event === 'auction:resumed')).toBeLessThan(frames.findIndex((frame) => frame.event === 'auction:timer:sync'));
});

test('shutdown removes only this publisher’s domain listeners and all owned timers', () => {
  const other = jest.fn(); eventBus.on(AUCTION_EVENTS.ACTION_UNDONE, other);
  send(AUCTION_EVENTS.LOT_OPENED, { liveState: live(2) });
  publisher.shutdown(); const count = frames.length;
  emitActionUndone(auctionId, { version: 3 }); jest.advanceTimersByTime(60_000);
  expect(other).toHaveBeenCalledTimes(1);
  expect(frames).toHaveLength(count);
  expect(jest.getTimerCount()).toBe(0);
  eventBus.off(AUCTION_EVENTS.ACTION_UNDONE, other);
});


test('extra time restarts an expired clock with the extended dial total, but never starts a paused clock', () => {
  send(AUCTION_EVENTS.LOT_OPENED, { liveState: live(1, 1) });
  jest.advanceTimersByTime(2000); expect(publisher.activeTimers.size).toBe(0);
  send(AUCTION_EVENTS.LOT_TIME_EXTENDED, { version: 2, status: 'LIVE', seconds: 30, liveState: { ...live(2, 30), timerTotalSeconds: 60 } });
  expect(last('auction:lot:time:extended').seconds).toBe(30);
  expect(last('auction:timer:sync')).toMatchObject({ remaining: 30, total: 60, version: 2 });
  expect(publisher.activeTimers.size).toBe(1);
  send(AUCTION_EVENTS.LOT_TIME_EXTENDED, { version: 3, status: 'PAUSED', seconds: 15, liveState: { ...live(3, 45), timerTotalSeconds: 75 } });
  expect(publisher.activeTimers.size).toBe(0);
  const count = frames.length; jest.advanceTimersByTime(60_000); expect(frames).toHaveLength(count);
});
