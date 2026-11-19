import { createClient } from 'redis';
import { logger } from '../config/logger.js';

export function destroySocketRedis(adapter) {
  for (const client of [adapter?.pubClient, adapter?.subClient]) {
    try { if (client?.isOpen) client.destroy(); } catch { /* Already closed. */ }
  }
}

/** Redis cannot hold server startup/shutdown hostage or queue stale live frames. */
export async function connectSocketRedis(url, { create = createClient, timeoutMs = 3500, log = logger } = {}) {
  if (!url) return null;
  let adapter;
  let timeout;
  let lastWarningAt = -Infinity;
  const warn = (error) => {
    if (Date.now() - lastWarningAt < 30_000) return;
    lastWarningAt = Date.now();
    log.warn({ message: error?.message }, 'Socket Redis unavailable; local delivery and REST reconciliation remain active');
  };
  try {
    const pubClient = create({ url, disableOfflineQueue: true, commandsQueueMaxLength: 1000,
      socket: { connectTimeout: 1500, reconnectStrategy: (attempt) => Math.min(1000 * (attempt + 1), 30_000) } });
    adapter = { pubClient, subClient: pubClient.duplicate() };
    for (const client of [adapter.pubClient, adapter.subClient]) client.on('error', warn);
    // redis-adapter broadcasts locally even when Redis is down, but does not
    // await node-redis's publish promise. Observe failures and discard stale
    // cross-worker packets instead of leaking unhandled rejections/queues.
    const publish = pubClient.publish.bind(pubClient);
    pubClient.publish = (...args) => pubClient.isReady
      ? publish(...args).catch((error) => { warn(error); return 0; }) : Promise.resolve(0);
    await Promise.race([
      Promise.all([adapter.pubClient.connect(), adapter.subClient.connect()]),
      new Promise((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('Socket Redis startup deadline reached')), timeoutMs); }),
    ]);
    return adapter;
  } catch (error) {
    warn(error);
    destroySocketRedis(adapter);
    return null;
  } finally { clearTimeout(timeout); }
}
