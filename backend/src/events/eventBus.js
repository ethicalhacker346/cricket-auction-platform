/**
 * EventBus — Central Domain Event Bus for Auction Platform
 * ------------------------------------------------------------------
 * Decouples core business logic (auction.service, bid.service) from
 * side-effects (socket publishing, notifications, analytics).
 *
 * Architecture:
 *   Service (transaction commit) -> eventBus.emit(domainEvent) -> 
 *   SocketPublisher (listens) -> io.to(room).emit(socketEvent)
 *
 * This file does NOT import io, services, or models — pure pub/sub.
 * Allows unit testing without socket.io.
 * 
 * Usage:
 *   import eventBus from './eventBus.js'
 *   eventBus.emit('auction:bid:placed', { auctionId, bid, ... })
 *   eventBus.on('auction:bid:placed', handler)
 */

import { EventEmitter } from 'events';

class AuctionEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    // For debugging in development
    if (process.env.NODE_ENV !== 'production') {
      this.on('error', (err) => {
        console.error('[EventBus] Unhandled error listener:', err);
      });
    }
  }

  /**
   * Safe emit that never throws — logs error instead.
   * Use this for post-transaction emissions.
   */
  safeEmit(eventName, payload) {
    try {
      // Attach timestamp if not present
      const enriched = {
        ...payload,
        _emittedAt: new Date(),
        _event: eventName,
      };
      return super.emit(eventName, enriched);
    } catch (err) {
      console.error(`[EventBus] Failed to emit ${eventName}`, err);
      return false;
    }
  }

  /**
   * Async emit — waits for all listeners to settle.
   * Useful if a listener returns Promise.
   */
  async emitAsync(eventName, payload) {
    const listeners = this.listeners(eventName);
    if (!listeners.length) return;
    const enriched = {
      ...payload,
      _emittedAt: new Date(),
      _event: eventName,
    };
    await Promise.allSettled(
      listeners.map((fn) => {
        try {
          return Promise.resolve(fn(enriched));
        } catch (e) {
          console.error(`[EventBus] Listener error for ${eventName}`, e);
        }
      })
    );
  }
}

// Singleton instance
const eventBus = new AuctionEventBus();

export default eventBus;
export { eventBus };
