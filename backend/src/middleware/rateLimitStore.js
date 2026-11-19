import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const stores = new Set();
let redisClient = null;
let lastWarningAt = -Infinity;

function warnDegraded(error) {
  if (Date.now() - lastWarningAt < 30_000) return;
  lastWarningAt = Date.now();
  logger.warn({ message: error?.message }, 'Rate-limit Redis unavailable; using bounded local protection');
}

function sharedClient() {
  if (!env.REDIS_URL) return null;
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1_000,
      commandTimeout: 1_000,
      retryStrategy: (attempt) => Math.min(1_000 * attempt, 30_000),
    });
    redisClient.on('error', warnDegraded);
    void redisClient.connect().catch(warnDegraded);
  }
  return redisClient;
}

/** Fixed windows with bounded cardinality, also used during Redis outages. */
export class BoundedMemoryStore {
  localKeys = true;
  constructor(maxKeys = 20_000) { this.maxKeys = maxKeys; this.clients = new Map(); }
  init({ windowMs }) {
    this.windowMs = windowMs;
    this.interval = setInterval(() => this.prune(), Math.max(1_000, windowMs));
    this.interval.unref?.();
  }
  prune() {
    const now = Date.now();
    this.lastPruneAt = now;
    for (const [key, value] of this.clients) if (value.resetTime.getTime() <= now) this.clients.delete(key);
  }
  bucket(key) {
    if (this.clients.has(key)) return key;
    if (this.clients.size >= this.maxKeys - 1 && Date.now() - (this.lastPruneAt ?? -Infinity) >= 1_000) this.prune();
    // Never evict a live offender to make room for a fresh spoofed identity.
    return this.clients.size < this.maxKeys - 1 ? key : '__overflow__';
  }
  async increment(key) {
    key = this.bucket(key);
    let value = this.clients.get(key);
    if (!value || value.resetTime.getTime() <= Date.now()) {
      value = { totalHits: 0, resetTime: new Date(Date.now() + this.windowMs) };
      this.clients.set(key, value);
    }
    value.totalHits += 1;
    return { ...value };
  }
  async get(key) { return this.clients.get(key); }
  async decrement(key) { const value = this.clients.get(key); if (value) value.totalHits = Math.max(0, value.totalHits - 1); }
  async resetKey(key) { this.clients.delete(key); }
  shutdown() { clearInterval(this.interval); this.clients.clear(); }
}

/** Redis is atomic across workers; an outage must not lock out the auction. */
export class ResilientRateLimitStore {
  localKeys = false;
  constructor(scope, { client = sharedClient, maxKeys } = {}) {
    this.prefix = `gullybid:rate:v2:${scope}:`;
    this.client = client;
    this.local = new BoundedMemoryStore(maxKeys);
  }
  init(options) { this.options = options; this.local.init(options); }
  shared() {
    // A half-open TCP connection can still report ready while commands time
    // out. Probe after a short cool-down, not on every bid in that interval.
    if (Date.now() < (this.retryRemoteAt ?? 0)) return null;
    const client = this.client();
    if (client?.status !== 'ready') return null;
    if (!this.remote) {
      this.remote = new RedisStore({ prefix: this.prefix, sendCommand: (...args) => client.call(...args) });
      // RedisStore eagerly loads two scripts, including an unused get script.
      // Observe both rejections so a disconnect during construction is safe.
      void this.remote.incrementScriptSha.catch(warnDegraded);
      void this.remote.getScriptSha.catch(warnDegraded);
      this.remote.init(this.options);
    }
    return this.remote;
  }
  async increment(key) {
    // Keep a local mirror warm, not an empty allowance on every Redis outage.
    const fallback = await this.local.increment(key);
    try {
      const remote = this.shared();
      return remote ? await remote.increment(key) : fallback;
    } catch (error) { this.retryRemoteAt = Date.now() + 5000; warnDegraded(error); return fallback; }
  }
  async decrement(key) {
    await this.local.decrement(key);
    try { await this.shared()?.decrement(key); } catch (error) { warnDegraded(error); }
  }
  async resetKey(key) {
    await this.local.resetKey(key);
    try { await this.shared()?.resetKey(key); } catch (error) { warnDegraded(error); }
  }
  shutdown() { this.local.shutdown(); }
}

export function createRateLimitStore(scope) {
  const store = new ResilientRateLimitStore(scope);
  stores.add(store);
  return store;
}

export async function closeRateLimitStores() {
  for (const store of stores) store.shutdown();
  stores.clear();
  redisClient?.disconnect();
  redisClient = null;
}
