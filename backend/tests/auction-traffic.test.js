import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createApiRateLimiter, auctionTrafficClass } from '../src/middleware/rateLimiter.js';
import { bidRateLimiter, rateLimitActor } from '../src/middleware/auctionRateLimiter.js';
import { BoundedMemoryStore, ResilientRateLimitStore, closeRateLimitStores } from '../src/middleware/rateLimitStore.js';
import { SocketConnectionGate, socketClientIp } from '../src/socket/connectionGate.js';
import { connectSocketRedis, destroySocketRedis } from '../src/socket/redisAdapter.js';
import { signAccessToken, verifyAccessToken } from '../src/utils/jwt.js';

const id = '1234567890abcdef12345678';
const base = `/api/v1/auctions/${id}`;
const token = (sub) => signAccessToken({ sub, role: 'FRANCHISE_OWNER' });
const owner1 = '111111111111111111111111';
const owner2 = '222222222222222222222222';
function appFor(options = {}, hops = 0) {
  const app = express(); app.set('trust proxy', hops); app.use(createApiRateLimiter({ development: false, ...options }));
  app.post(`${base}/bids`, (req, _res, next) => {
    const auth = req.headers.authorization?.slice(7);
    req.user = { _id: auth ? verifyAccessToken(auth).sub : owner1 }; next();
  }, bidRateLimiter, (_req, res) => res.json({ success: true }));
  app.use((_req, res) => res.json({ success: true })); return app;
}
afterAll(closeRateLimitStores);
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('600 normal viewing/heartbeat requests do not consume ordinary API or auction-command budgets', async () => {
  const app = appFor({ generalMax: 2, commandMax: 2 });
  for (let i = 0; i < 300; i += 1) {
    await request(app).get(`${base}/snapshot`).expect(200);
    await request(app).post(`${base}/viewers/heartbeat`).expect(200);
  }
  await request(app).post(`${base}/pause`).expect(200);
  await request(app).get('/api/v1/notifications').expect(200);
  await request(app).get('/api/v1/notifications').expect(200);
  const limited = await request(app).get('/api/v1/notifications').expect(429);
  expect(limited.body).toMatchObject({ success: false, code: 'RATE_LIMITED', scope: 'general' });
  expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  await request(app).get(`${base}/snapshot`).expect(200);
  await request(app).post(`${base}/lot/time`).expect(200);
});

test('a spectator read flood is bounded but cannot use up the organizer or bid allowance', async () => {
  const app = appFor({ guestMax: 2, commandMax: 2 });
  await request(app).get(`${base}/snapshot`).expect(200);
  await request(app).get(`${base}/live`).expect(200);
  await request(app).get(`${base}/snapshot`).expect(429);
  await request(app).post(`${base}/lot/time`).expect(200);
  await request(app).post(`${base}/bids`).set('Authorization', `Bearer ${token(owner2)}`).expect(200);
});

test('owners behind the same IP have independent cryptographically verified buckets', async () => {
  const app = appFor({ readMax: 1, guestMax: 1 });
  await request(app).get(`${base}/permissions`).set('Authorization', `Bearer ${token(owner1)}`).expect(200);
  await request(app).get(`${base}/permissions`).set('Authorization', `Bearer ${token(owner1)}`).expect(429);
  await request(app).get(`${base}/permissions`).set('Authorization', `Bearer ${token(owner2)}`).expect(200);
  await request(app).get(`${base}/snapshot`).expect(200);
});

test('forged JWTs, viewer IDs, query strings and untrusted forwarding headers do not create new budgets', async () => {
  const app = appFor({ guestMax: 1 });
  await request(app).get(`${base}/snapshot?viewerId=one`).set('X-Forwarded-For', '198.51.100.1').expect(200);
  await request(app).get(`${base}/snapshot?viewerId=two`).set('X-Forwarded-For', '198.51.100.2').set('Authorization', 'Bearer forged.token.signature').expect(429);
  expect(rateLimitActor({ headers: { authorization: 'Bearer forged.token.signature' }, ip: '203.0.113.1' })).toBe('ip:203.0.113.1');
});

test('only an explicitly configured ingress hop may supply the client IP', async () => {
  const app = appFor({ generalMax: 1 }, 1);
  await request(app).get('/api/v1/other').set('X-Forwarded-For', '198.51.100.21').expect(200);
  await request(app).get('/api/v1/other').set('X-Forwarded-For', '198.51.100.22').expect(200);
  await request(app).get('/api/v1/other').set('X-Forwarded-For', '198.51.100.21').expect(429);
});

test('bid burst protection uses canonical _id and never combines two owners at a venue', async () => {
  const app = appFor();
  const first = token('333333333333333333333333'); const second = token('444444444444444444444444');
  for (let i = 0; i < 8; i += 1) await request(app).post(`${base}/bids`).set('Authorization', `Bearer ${first}`).expect(200);
  const rejected = await request(app).post(`${base}/bids`).set('Authorization', `Bearer ${first}`).expect(429);
  expect(rejected.body.scope).toBe('auction-bid-burst');
  await request(app).post(`${base}/bids`).set('Authorization', `Bearer ${second}`).expect(200);
});

test('unknown or lookalike routes cannot evade the general limiter', async () => {
  expect(auctionTrafficClass({ method: 'POST', path: `${base}/snapshot` })).toBe('general');
  expect(auctionTrafficClass({ method: 'GET', path: `${base}/snapshot/anything` })).toBe('general');
  expect(auctionTrafficClass({ method: 'GET', path: `/api/v1/tournaments/${id}/auction` })).toBe('read');
  const app = appFor({ generalMax: 1 });
  await request(app).get(`${base}/unknown`).expect(200);
  await request(app).get(`${base}/unknown`).expect(429);
});

test('development relaxes ordinary/live traffic without disabling production protection', async () => {
  const app = appFor({ generalMax: 1, development: true });
  for (let i = 0; i < 20; i += 1) await request(app).get('/api/v1/other').expect(200);
  await request(app).get('/api/v1/other').expect(429);
});

test('local fallback has bounded key cardinality, does not evict live offenders, and expires cleanly', async () => {
  jest.useFakeTimers();
  const store = new BoundedMemoryStore(4); store.init({ windowMs: 1000 });
  try {
    for (let i = 0; i < 100; i += 1) await store.increment(`identity-${i}`);
    expect(store.clients.size).toBeLessThanOrEqual(4);
    expect((await store.increment('identity-0')).totalHits).toBe(2);
    jest.advanceTimersByTime(1001);
    expect((await store.increment('identity-0')).totalHits).toBe(1);
  } finally { store.shutdown(); }
});

test('a Redis outage keeps warm local protection instead of returning a 500 or blocking the auction', async () => {
  const client = { status: 'reconnecting', call: jest.fn().mockRejectedValue(new Error('Redis offline')) };
  const store = new ResilientRateLimitStore('outage-test', { client: () => client }); store.init({ windowMs: 2000 });
  try {
    expect((await store.increment('user-a')).totalHits).toBe(1);
    client.status = 'ready';
    expect((await store.increment('user-a')).totalHits).toBe(2);
    client.status = 'reconnecting';
    expect((await store.increment('user-a')).totalHits).toBe(3);
  } finally { store.shutdown(); }
});

test('a half-open Redis connection is circuit-broken rather than stalling every bid', async () => {
  jest.useFakeTimers();
  const client = { status: 'ready', call: jest.fn().mockRejectedValue(new Error('Command timed out')) };
  const store = new ResilientRateLimitStore('half-open', { client: () => client }); store.init({ windowMs: 10_000 });
  try {
    expect((await store.increment('user')).totalHits).toBe(1);
    const attempts = client.call.mock.calls.length;
    expect((await store.increment('user')).totalHits).toBe(2);
    expect((await store.increment('user')).totalHits).toBe(3);
    expect(client.call).toHaveBeenCalledTimes(attempts);
    jest.advanceTimersByTime(5001);
    await store.increment('user');
    expect(client.call.mock.calls.length).toBeGreaterThan(attempts);
  } finally { store.shutdown(); }
});

test('more than ten venue spectators can connect, while active account leases survive minute boundaries and release once', async () => {
  jest.useFakeTimers();
  const gate = new SocketConnectionGate({ maxPerIp: 50, maxPerUser: 2 });
  try {
    const releases = [];
    for (let i = 0; i < 20; i += 1) releases.push(await gate.acquire('venue-ip', null));
    const first = await gate.acquire('venue-ip', owner1); const second = await gate.acquire('venue-ip', owner1);
    jest.advanceTimersByTime(61_000);
    await expect(gate.acquire('venue-ip', owner1)).rejects.toThrow('Too many open auction tabs');
    first(); first();
    const replacement = await gate.acquire('venue-ip', owner1);
    second(); replacement(); releases.forEach((release) => release());
    expect(gate.active.size).toBe(0);
  } finally { gate.close(); }
});

test('socket IP calculation ignores a forged header unless its ingress hop is trusted', () => {
  const socket = { request: { headers: { 'x-forwarded-for': '198.51.100.1' }, socket: { remoteAddress: '127.0.0.1' } }, handshake: { address: '127.0.0.1' } };
  expect(socketClientIp(socket, 0)).toBe('127.0.0.1');
  expect(socketClientIp(socket, 1)).toBe('198.51.100.1');
});


function fakeSocketRedis(connect = () => Promise.resolve()) {
  const make = () => ({ isOpen: true, isReady: true, on: jest.fn(), connect: jest.fn(connect), destroy: jest.fn(), publish: jest.fn().mockResolvedValue(1) });
  const pubClient = make(); const subClient = make(); pubClient.duplicate = () => subClient;
  return { pubClient, subClient, create: jest.fn(() => pubClient) };
}

test('Socket Redis is optional and a publish rejection never becomes an unhandled auction exception', async () => {
  const fake = fakeSocketRedis(); const log = { warn: jest.fn() };
  expect(await connectSocketRedis(undefined, { create: fake.create, log })).toBeNull();
  expect(fake.create).not.toHaveBeenCalled();
  fake.pubClient.publish.mockRejectedValueOnce(new Error('Redis connection reset'));
  const adapter = await connectSocketRedis('redis://test-only', { create: fake.create, log });
  expect(adapter).not.toBeNull();
  await expect(adapter.pubClient.publish('room', 'frame')).resolves.toBe(0);
  expect(log.warn).toHaveBeenCalledTimes(1);
  fake.pubClient.isReady = false;
  await expect(adapter.pubClient.publish('room', 'stale-frame')).resolves.toBe(0);
  destroySocketRedis(adapter);
  expect(fake.pubClient.destroy).toHaveBeenCalledTimes(1); expect(fake.subClient.destroy).toHaveBeenCalledTimes(1);
});

test('a stalled Redis adapter cannot block server startup and both owned clients are destroyed', async () => {
  jest.useFakeTimers();
  const fake = fakeSocketRedis(() => new Promise(() => {}));
  const result = connectSocketRedis('redis://test-only', { create: fake.create, timeoutMs: 50, log: { warn: jest.fn() } });
  await jest.advanceTimersByTimeAsync(51);
  expect(await result).toBeNull();
  expect(fake.pubClient.destroy).toHaveBeenCalledTimes(1); expect(fake.subClient.destroy).toHaveBeenCalledTimes(1);
});
