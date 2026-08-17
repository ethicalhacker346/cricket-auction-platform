/**
 * utils/distributedLock.js — Redis-backed distributed mutex
 * -----------------------------------------------------------
 * • Prevents duplicate cron jobs across multiple server instances
 * • Auto-expires locks (prevents deadlocks if instance crashes)
 * • Lock ownership verification (prevents accidental unlock by other instance)
 */

import Redis from 'ioredis';
import { logger } from '../config/logger.js';

let redis = null;

function getRedis() {
  if (!redis && process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    
    redis.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });
  }
  return redis;
}

export async function withDistributedLock(lockKey, ttlSeconds, fn) {
  const client = getRedis();
  
  if (!client) {
    logger.warn({ lockKey }, 'No Redis available, running without distributed lock');
    return fn();
  }

  const fullKey = `gullybid:lock:${lockKey}`;
  const lockValue = `${Date.now()}-${Math.random().toString(36).slice(2)}-${process.pid}`;

  try {
    const acquired = await client.set(fullKey, lockValue, 'EX', ttlSeconds, 'NX');
    
    if (!acquired) {
      logger.info({ lockKey }, 'Lock already held by another instance, skipping');
      return null;
    }

    logger.debug({ lockKey, ttlSeconds }, 'Lock acquired');

    try {
      return await fn();
    } finally {
      const current = await client.get(fullKey);
      if (current === lockValue) {
        await client.del(fullKey);
        logger.debug({ lockKey }, 'Lock released');
      } else {
        logger.warn({ lockKey }, 'Lock expired or stolen before release');
      }
    }
  } catch (err) {
    logger.error({ err, lockKey }, 'Distributed lock error');
    throw err;
  }
}

export async function isLocked(lockKey) {
  const client = getRedis();
  if (!client) return false;
  const exists = await client.exists(`gullybid:lock:${lockKey}`);
  return exists === 1;
}

export async function extendLock(lockKey, lockValue, additionalSeconds) {
  const client = getRedis();
  if (!client) return false;
  
  const fullKey = `gullybid:lock:${lockKey}`;
  const current = await client.get(fullKey);
  if (current !== lockValue) return false;
  
  await client.expire(fullKey, additionalSeconds);
  return true;
}