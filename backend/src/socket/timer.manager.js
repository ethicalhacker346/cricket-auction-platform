/**
 * timer.manager.js — Dedicated Auction Timer Manager (optional modular extract)
 * ------------------------------------------------------------------------------
 * Keeps SocketPublisher lean if you prefer separation of concerns.
 * This is an alternative to the timer logic inside socket.publisher.js
 * You can either use this module standalone or keep coupled version.
 *
 * Usage:
 *  import TimerManager from './timer.manager.js'
 *  const timerManager = new TimerManager(io)
 *  timerManager.startTimer(auctionId, remaining, liveState)
 */

export class TimerManager {
  constructor(io) {
    this.io = io;
    this.activeTimers = new Map(); // auctionId -> intervalId
    this.timerState = new Map();   // auctionId -> { expiresAt, total, version, ... }
  }

  publish(auctionId, event, payload) {
    this.io.to(`auction:${auctionId}`).emit(event, payload);
  }

  startTimer(auctionId, remainingSeconds, liveState = {}) {
    this.stopTimer(auctionId);
    const totalSeconds = liveState.lotTimerSeconds || remainingSeconds || 30;
    const expiresAt = Date.now() + remainingSeconds * 1000;

    this.timerState.set(auctionId, {
      remainingSeconds,
      totalSeconds,
      expiresAt,
      version: liveState.version ?? 0,
      lotStatus: liveState.lotStatus || 'BIDDING',
      isPaused: false,
      startedAt: new Date(),
    });

    let ticks = 0;
    const interval = setInterval(() => {
      const state = this.timerState.get(auctionId);
      if (!state || state.isPaused) return;
      const trueRemaining = Math.max(0, (state.expiresAt - Date.now()) / 1000);
      ticks++;

      this.publish(auctionId, 'auction:timer:tick', {
        auctionId,
        remaining: Math.ceil(trueRemaining * 10) / 10,
        total: state.totalSeconds,
        version: state.version,
        isRunning: trueRemaining > 0,
        serverTime: new Date().toISOString(),
        expiresAt: new Date(state.expiresAt).toISOString(),
      });

      if (ticks % 5 === 0) {
        this.publish(auctionId, 'auction:timer:sync', {
          auctionId,
          remaining: trueRemaining,
          total: state.totalSeconds,
          serverTime: new Date().toISOString(),
          expiresAt: new Date(state.expiresAt).toISOString(),
        });
      }

      if (trueRemaining <= 0) {
        this.publish(auctionId, 'auction:timer:expired', {
          auctionId,
          timestamp: new Date().toISOString(),
        });
        this.stopTimer(auctionId);
      }
    }, 1000);

    this.activeTimers.set(auctionId, interval);

    this.publish(auctionId, 'auction:timer:sync', {
      auctionId,
      remaining: remainingSeconds,
      total: totalSeconds,
      serverTime: new Date().toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      isRunning: true,
    });
  }

  adjustTimer(auctionId, newRemaining, liveState = {}) {
    const state = this.timerState.get(auctionId);
    if (!state) {
      if (liveState.lotStatus === 'BIDDING') this.startTimer(auctionId, newRemaining, liveState);
      return;
    }
    state.expiresAt = Date.now() + newRemaining * 1000;
    state.version = liveState.version ?? state.version;
    state.remainingSeconds = newRemaining;

    this.publish(auctionId, 'auction:timer:sync', {
      auctionId,
      remaining: newRemaining,
      total: state.totalSeconds,
      version: state.version,
      serverTime: new Date().toISOString(),
      expiresAt: new Date(state.expiresAt).toISOString(),
      reason: 'BID_PLACED',
    });
  }

  pauseTimer(auctionId) {
    const state = this.timerState.get(auctionId);
    if (state) {
      state.isPaused = true;
      state.pausedRemaining = Math.max(0, (state.expiresAt - Date.now()) / 1000);
    }
  }

  resumeTimer(auctionId) {
    const state = this.timerState.get(auctionId);
    if (state?.isPaused) {
      state.isPaused = false;
      state.expiresAt = Date.now() + (state.pausedRemaining || 0) * 1000;
      delete state.pausedRemaining;
    }
  }

  stopTimer(auctionId) {
    if (this.activeTimers.has(auctionId)) {
      clearInterval(this.activeTimers.get(auctionId));
      this.activeTimers.delete(auctionId);
    }
    this.timerState.delete(auctionId);
    this.publish(auctionId, 'auction:timer:stopped', {
      auctionId,
      timestamp: new Date().toISOString(),
    });
  }

  shutdown() {
    for (const id of this.activeTimers.values()) clearInterval(id);
    this.activeTimers.clear();
    this.timerState.clear();
  }
}

export default TimerManager;
