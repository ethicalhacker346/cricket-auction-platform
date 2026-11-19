import proxyaddr from 'proxy-addr';
import { env } from '../config/env.js';
import { BoundedMemoryStore } from '../middleware/rateLimitStore.js';

/** Same explicit proxy boundary as Express; never trust arbitrary XFF input. */
export function socketClientIp(socket, hops = env.TRUST_PROXY_HOPS) {
  return proxyaddr(socket.request, (_address, index) => index < hops) || socket.handshake.address;
}

export class SocketConnectionGate {
  constructor({ maxPerIp = env.SOCKET_MAX_CONNECTIONS_PER_IP, maxPerUser = 8, attemptsPerIp = 10_000, attemptsPerUser = 120 } = {}) {
    this.maxPerIp = maxPerIp;
    this.maxPerUser = maxPerUser;
    this.attemptsPerIp = attemptsPerIp;
    this.attemptsPerUser = attemptsPerUser;
    this.active = new Map();
    this.attempts = new BoundedMemoryStore();
    this.attempts.init({ windowMs: 60_000 });
  }
  async checkAttempt(ip) {
    if ((await this.attempts.increment(`ip:${ip}`)).totalHits > this.attemptsPerIp) {
      throw new Error('Connection attempts are arriving too quickly. Please retry shortly.');
    }
  }
  async acquire(ip, userId) {
    if (userId && (await this.attempts.increment(`user:${userId}`)).totalHits > this.attemptsPerUser) {
      throw new Error('Please wait a moment before reconnecting this account.');
    }
    const keys = [`ip:${ip}`, ...(userId ? [`user:${userId}`] : [])];
    if ((this.active.get(keys[0]) ?? 0) >= this.maxPerIp || (userId && (this.active.get(keys[1]) ?? 0) >= this.maxPerUser)) {
      throw new Error('Too many open auction tabs. Close an unused tab and retry.');
    }
    if (this.active.size + keys.filter((key) => !this.active.has(key)).length > 20_000) {
      throw new Error('The live room is busy. Please retry shortly.');
    }
    for (const key of keys) this.active.set(key, (this.active.get(key) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      for (const key of keys) {
        const count = (this.active.get(key) ?? 1) - 1;
        if (count > 0) this.active.set(key, count); else this.active.delete(key);
      }
    };
  }
  close() { this.attempts.shutdown(); this.active.clear(); }
}
