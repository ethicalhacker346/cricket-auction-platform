/** Opt-in integration check. Use a DISPOSABLE Redis URL, never production. */
import '../tests/setup.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import Redis from 'ioredis';
import { connectSocketRedis, destroySocketRedis } from '../src/socket/redisAdapter.js';
import { ResilientRateLimitStore } from '../src/middleware/rateLimitStore.js';

const url = process.env.RATE_LIMIT_TEST_REDIS_URL;
if (!url) throw new Error('Set RATE_LIMIT_TEST_REDIS_URL to a disposable Redis instance.');
const clients = [0, 1].map(() => new Redis(url, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 0, connectTimeout: 2000, commandTimeout: 2000 }));
let socketRedis;
const scope = `integration-${randomUUID()}`;
const stores = clients.map((client) => new ResilientRateLimitStore(scope, { client: () => client }));
const isolated = new ResilientRateLimitStore(`${scope}-isolated`, { client: () => clients[1] });
const all = [...stores, isolated];
all.forEach((store) => store.init({ windowMs: 1500 }));
try {
  await Promise.all(clients.map((client) => client.connect()));
  assert.equal((await stores[0].increment('owner')).totalHits, 1);
  assert.equal((await stores[1].increment('owner')).totalHits, 2);
  assert.equal((await stores[0].increment('owner')).totalHits, 3);
  assert.equal((await stores[1].increment('different-owner')).totalHits, 1);
  assert.equal((await isolated.increment('owner')).totalHits, 1);
  console.log('PASS: independent workers share atomic counters; scopes and identities remain isolated');

  const ended = once(clients[0], 'end');
  clients[0].disconnect();
  await ended;
  assert.equal((await stores[0].increment('owner')).totalHits, 3); // two prior local hits + this hit
  console.log('PASS: loss of a real Redis connection falls back to the warm local counter');
  await clients[0].connect();
  assert.equal((await stores[0].increment('owner')).totalHits, 4);
  await stores[0].decrement('owner');
  assert.equal((await stores[1].increment('owner')).totalHits, 4);
  await stores[0].resetKey('owner');
  assert.equal((await stores[1].increment('owner')).totalHits, 1);
  console.log('PASS: a restored connection rejoins shared counters, including decrement/reset');

  await new Promise((resolve) => setTimeout(resolve, 1600));
  assert.equal((await stores[0].increment('owner')).totalHits, 1);
  console.log('PASS: shared fixed-window expiry resets cleanly');
  socketRedis = await connectSocketRedis(url);
  assert(socketRedis, 'Real Socket.IO Redis clients should connect');
  let receive;
  const received = new Promise((resolve) => { receive = resolve; });
  await socketRedis.subClient.subscribe(scope, receive);
  let deliveryTimeout;
  try {
    await socketRedis.pubClient.publish(scope, 'live-frame');
    const message = await Promise.race([received,
      new Promise((_resolve, reject) => { deliveryTimeout = setTimeout(() => reject(new Error('Pub/sub delivery deadline reached')), 2000); }),
    ]);
    assert.equal(message, 'live-frame');
  } finally { clearTimeout(deliveryTimeout); }
  console.log('PASS: the bounded Socket.IO Redis clients publish and subscribe with node-redis');
} finally {
  // Only this run's randomly-prefixed keys; never FLUSHDB/SCRIPT FLUSH.
  const ready = clients.find((client) => client.status === 'ready');
  if (ready) await ready.del(...all.flatMap((store) => ['owner', 'different-owner'].map((key) => `${store.prefix}${key}`))).catch(() => {});
  destroySocketRedis(socketRedis);
  all.forEach((store) => store.shutdown());
  clients.forEach((client) => client.disconnect());
}
