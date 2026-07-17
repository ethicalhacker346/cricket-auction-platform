/**
 * socket.publisher.js — Socket Event Publisher
 * ----------------------------------------------------------------
 * Bridges Domain Events (eventBus) -> Socket.IO rooms
 * 
 * Architecture:
 *   Service commits TX -> auction.events.emitXxx() -> eventBus -> 
 *   SocketPublisher listens -> io.to(`auction:${auctionId}`).emit(socketEvent, payload)
 *
 * This file DOES depend on socket.io, but services do NOT — perfect decoupling.
 * 
 * Also manages per-auction lot timers (authoritative server timer broadcast).
 */

import eventBus from '../events/eventBus.js';
import { AUCTION_EVENTS } from '../events/auction.events.js';

class SocketEventPublisher {
  constructor(io) {
    this.io = io;
    // auctionId -> intervalId
    this.activeTimers = new Map();
    // auctionId -> { remaining, total, lotStatus, expiresAt, version }
    this.timerState = new Map();
    this.isListening = false;
  }

  /**
   * Start listening to domain events — call once after io init
   */
  init() {
    if (this.isListening) return;
    this.isListening = true;

    // Auction lifecycle
    eventBus.on(AUCTION_EVENTS.AUCTION_STARTED, (p) => this.handleAuctionStarted(p));
    eventBus.on(AUCTION_EVENTS.AUCTION_PAUSED, (p) => this.handleAuctionPaused(p));
    eventBus.on(AUCTION_EVENTS.AUCTION_RESUMED, (p) => this.handleAuctionResumed(p));
    eventBus.on(AUCTION_EVENTS.AUCTION_COMPLETED, (p) => this.handleAuctionCompleted(p));
    eventBus.on(AUCTION_EVENTS.AUCTION_RULES_UPDATED, (p) => this.handleRulesUpdated(p));

    // Round
    eventBus.on(AUCTION_EVENTS.ROUND_ADDED, (p) => this.handleRoundAdded(p));
    eventBus.on(AUCTION_EVENTS.ROUND_UPDATED, (p) => this.handleRoundUpdated(p));
    eventBus.on(AUCTION_EVENTS.ROUND_DELETED, (p) => this.handleRoundDeleted(p));
    eventBus.on(AUCTION_EVENTS.ROUND_COMPLETED, (p) => this.handleRoundCompleted(p));

    // Lot
    eventBus.on(AUCTION_EVENTS.LOT_OPENED, (p) => this.handleLotOpened(p));
    eventBus.on(AUCTION_EVENTS.LOT_SOLD, (p) => this.handleLotSold(p));
    eventBus.on(AUCTION_EVENTS.LOT_UNSOLD, (p) => this.handleLotUnsold(p));
    eventBus.on(AUCTION_EVENTS.LIVE_STATE_UPDATED, (p) => this.handleLiveStateUpdated(p));

    // Bidding
    eventBus.on(AUCTION_EVENTS.BID_PLACED, (p) => this.handleBidPlaced(p));

    // Presence
    eventBus.on(AUCTION_EVENTS.VIEWER_COUNT_UPDATED, (p) => this.handleViewerCountUpdated(p));
    eventBus.on(AUCTION_EVENTS.VIEWER_JOINED, (p) => this.handleViewerJoined(p));
    eventBus.on(AUCTION_EVENTS.VIEWER_LEFT, (p) => this.handleViewerLeft(p));

    console.log('[SocketPublisher] Listening to auction domain events');
  }

  // ---------- low level publish ----------
  publishToAuction(auctionId, socketEvent, payload) {
    try {
      const room = `auction:${auctionId}`;
      this.io.to(room).emit(socketEvent, payload);
      if (process.env.DEBUG_SOCKET) {
        console.log(`[SocketPublisher] -> ${room} :: ${socketEvent}`, payload?.auctionId || '');
      }
    } catch (err) {
      console.error(`[SocketPublisher] Failed to publish ${socketEvent} for ${auctionId}`, err);
    }
  }

  publishToAll(socketEvent, payload) {
    this.io.emit(socketEvent, payload);
  }

  // ---------- Auction handlers ----------
  handleAuctionStarted({ auctionId, auction, tournamentId, startedBy, _emittedAt }) {
    this.stopTimer(auctionId); // clear any stale timer
    this.publishToAuction(auctionId, 'auction:started', {
      auctionId,
      auction,
      tournamentId,
      startedBy,
      timestamp: _emittedAt,
    });
    this.publishToAuction(auctionId, 'auction:log', {
      auctionId,
      action: 'AUCTION_STARTED',
      message: 'Auction started',
      timestamp: _emittedAt,
      userId: startedBy,
    });
  }

  handleAuctionPaused({ auctionId, auction, pausedBy, _emittedAt }) {
    this.pauseTimer(auctionId);
    this.publishToAuction(auctionId, 'auction:paused', {
      auctionId,
      auction,
      pausedBy,
      timestamp: _emittedAt,
    });
  }

  handleAuctionResumed({ auctionId, auction, resumedBy, _emittedAt }) {
    this.resumeTimer(auctionId);
    this.publishToAuction(auctionId, 'auction:resumed', {
      auctionId,
      auction,
      resumedBy,
      timestamp: _emittedAt,
    });
  }

  handleAuctionCompleted({ auctionId, auction, completedBy, _emittedAt }) {
    this.stopTimer(auctionId);
    this.publishToAuction(auctionId, 'auction:completed', {
      auctionId,
      auction,
      completedBy,
      timestamp: _emittedAt,
    });
    // optional global broadcast for lobby screens
    this.publishToAll('auction:global:completed', { auctionId, timestamp: _emittedAt });
  }

  handleRulesUpdated({ auctionId, patch, updatedBy, auction, _emittedAt }) {
    this.publishToAuction(auctionId, 'auction:rules:updated', {
      auctionId,
      patch,
      auction,
      updatedBy,
      timestamp: _emittedAt,
    });
  }

  // ---------- Round handlers ----------
  handleRoundAdded({ auctionId, round, _emittedAt }) {
    this.publishToAuction(auctionId, 'auction:round:added', {
      auctionId,
      round,
      timestamp: _emittedAt,
    });
  }

  handleRoundUpdated({ auctionId, round, patch, _emittedAt }) {
    this.publishToAuction(auctionId, 'auction:round:updated', {
      auctionId,
      round,
      patch,
      timestamp: _emittedAt,
    });
  }

  handleRoundDeleted({ auctionId, roundId, roundName, _emittedAt }) {
    this.publishToAuction(auctionId, 'auction:round:deleted', {
      auctionId,
      roundId,
      roundName,
      timestamp: _emittedAt,
    });
  }

  handleRoundCompleted({ auctionId, roundId, round, _emittedAt }) {
    this.publishToAuction(auctionId, 'auction:round:completed', {
      auctionId,
      roundId,
      round,
      timestamp: _emittedAt,
    });
  }

  // ---------- Lot handlers ----------
  handleLotOpened({ auctionId, tournamentPlayerId, roundId, currentPlayer, currentRound, liveState, openedBy, _emittedAt }) {
    // Start authoritative timer
    const total = liveState?.remainingTimeSeconds || 0;
    this.startTimer(auctionId, total, liveState);

    this.publishToAuction(auctionId, 'auction:lot:opened', {
      auctionId,
      tournamentPlayerId,
      roundId,
      currentPlayer,
      currentRound,
      liveState: {
        ...liveState,
        _serverTime: _emittedAt,
        _expiresAt: new Date(new Date(_emittedAt).getTime() + total * 1000).toISOString(),
      },
      openedBy,
      timestamp: _emittedAt,
    });

    this.publishToAuction(auctionId, 'auction:liveState', {
      auctionId,
      liveState,
      trigger: 'LOT_OPENED',
      timestamp: _emittedAt,
    });
  }

  handleLotSold({ auctionId, tournamentPlayerId, roundId, soldPrice, soldToTeamId, soldToTeamName, liveState, settledBy, _emittedAt }) {
    this.stopTimer(auctionId);
    this.publishToAuction(auctionId, 'auction:lot:sold', {
      auctionId,
      tournamentPlayerId,
      roundId,
      soldPrice,
      soldToTeamId,
      soldToTeamName,
      liveState,
      settledBy,
      timestamp: _emittedAt,
    });
    this.publishToAuction(auctionId, 'auction:liveState', {
      auctionId,
      liveState,
      trigger: 'LOT_SOLD',
      timestamp: _emittedAt,
    });
  }

  handleLotUnsold({ auctionId, tournamentPlayerId, roundId, liveState, settledBy, _emittedAt }) {
    this.stopTimer(auctionId);
    this.publishToAuction(auctionId, 'auction:lot:unsold', {
      auctionId,
      tournamentPlayerId,
      roundId,
      liveState,
      settledBy,
      timestamp: _emittedAt,
    });
    this.publishToAuction(auctionId, 'auction:liveState', {
      auctionId,
      liveState,
      trigger: 'LOT_UNSOLD',
      timestamp: _emittedAt,
    });
  }

  handleLiveStateUpdated({ auctionId, liveState, trigger, _emittedAt }) {
    this.publishToAuction(auctionId, 'auction:liveState', {
      auctionId,
      liveState,
      trigger,
      timestamp: _emittedAt,
    });
  }

  // ---------- Bid handlers ----------
  handleBidPlaced({
    auctionId,
    bid,
    tournamentPlayerId,
    roundId,
    amount,
    teamId,
    teamName,
    liveState,
    placedBy,
    previousHighestBid,
    _emittedAt,
  }) {
    // Adjust timer to anti-snipe reset value
    if (liveState?.remainingTimeSeconds) {
      this.adjustTimer(auctionId, liveState.remainingTimeSeconds, liveState);
    }

    // 1) New bid event — every client listening to this auction
    this.publishToAuction(auctionId, 'auction:bid:placed', {
      auctionId,
      bid,
      tournamentPlayerId,
      roundId,
      amount,
      teamId,
      teamName,
      previousHighestBid,
      liveState,
      placedBy,
      timestamp: _emittedAt,
    });

    // 2) Live state sync (currentHighestBid, highestBidderTeamId, remainingTime, version)
    this.publishToAuction(auctionId, 'auction:liveState', {
      auctionId,
      liveState,
      trigger: 'BID_PLACED',
      timestamp: _emittedAt,
    });

    // 3) Log entry
    this.publishToAuction(auctionId, 'auction:log', {
      auctionId,
      action: 'BID_PLACED',
      message: `Bid of ${amount} placed by ${teamName}`,
      metadata: { bidId: bid?._id || bid?.id, amount, teamId },
      timestamp: _emittedAt,
      userId: placedBy,
    });

    // 4) Direct notification to previous highest bidder being outbid (if identifiable)
    if (previousHighestBid && previousHighestBid !== amount) {
      // could emit to user-specific room if you have user rooms
      // this.io.to(`user:${prevTeamOwnerId}`).emit('auction:bid:outbid', ...)
    }
  }

  // ---------- Presence ----------
  handleViewerCountUpdated({ auctionId, viewerCount, _emittedAt }) {
    this.publishToAuction(auctionId, 'auction:viewer:count', {
      auctionId,
      viewerCount,
      timestamp: _emittedAt,
    });
  }

  handleViewerJoined({ auctionId, viewerId, userId, viewerCount, _emittedAt }) {
    this.publishToAuction(auctionId, 'auction:viewer:joined', {
      auctionId,
      viewerId,
      userId,
      viewerCount,
      timestamp: _emittedAt,
    });
  }

  handleViewerLeft({ auctionId, viewerId, viewerCount, _emittedAt }) {
    this.publishToAuction(auctionId, 'auction:viewer:left', {
      auctionId,
      viewerId,
      viewerCount,
      timestamp: _emittedAt,
    });
  }

  // ===================== TIMER MANAGEMENT =====================
  /**
   * Start authoritative lot timer
   * Frontend should still interpolate locally, but this is the server truth
   * broadcast every second + sync every 5 sec.
   */
  startTimer(auctionId, remainingSeconds, liveState = {}) {
    this.stopTimer(auctionId);

    const totalSeconds = liveState?.lotTimerSeconds || remainingSeconds || 30;
    const expiresAt = Date.now() + remainingSeconds * 1000;

    this.timerState.set(auctionId, {
      remainingSeconds,
      totalSeconds,
      expiresAt,
      version: liveState?.version ?? 0,
      lotStatus: liveState?.lotStatus || 'BIDDING',
      startedAt: new Date(),
      isPaused: false,
    });

    let ticks = 0;
    const interval = setInterval(() => {
      const state = this.timerState.get(auctionId);
      if (!state || state.isPaused) return;

      const trueRemaining = Math.max(0, (state.expiresAt - Date.now()) / 1000);
      ticks += 1;

      // Every second emit tick
      this.publishToAuction(auctionId, 'auction:timer:tick', {
        auctionId,
        remaining: Math.ceil(trueRemaining * 10) / 10, // 0.1s precision
        total: state.totalSeconds,
        version: state.version,
        isRunning: trueRemaining > 0,
        serverTime: new Date().toISOString(),
        expiresAt: new Date(state.expiresAt).toISOString(),
      });

      // Every 5 ticks send full sync (correct drift)
      if (ticks % 5 === 0) {
        this.publishToAuction(auctionId, 'auction:timer:sync', {
          auctionId,
          remaining: trueRemaining,
          total: state.totalSeconds,
          serverTime: new Date().toISOString(),
          expiresAt: new Date(state.expiresAt).toISOString(),
        });
      }

      if (trueRemaining <= 0) {
        this.publishToAuction(auctionId, 'auction:timer:expired', {
          auctionId,
          timestamp: new Date().toISOString(),
        });
        this.stopTimer(auctionId);
      }
    }, 1000);

    this.activeTimers.set(auctionId, interval);

    // Immediate sync on start
    this.publishToAuction(auctionId, 'auction:timer:sync', {
      auctionId,
      remaining: remainingSeconds,
      total: totalSeconds,
      serverTime: new Date().toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      isRunning: true,
    });
  }

  adjustTimer(auctionId, newRemainingSeconds, liveState = {}) {
    const state = this.timerState.get(auctionId);
    if (!state) {
      // No active timer — start one if lot is BIDDING
      if (liveState?.lotStatus === 'BIDDING') {
        this.startTimer(auctionId, newRemainingSeconds, liveState);
      }
      return;
    }
    state.expiresAt = Date.now() + newRemainingSeconds * 1000;
    state.version = liveState?.version ?? state.version;
    state.remainingSeconds = newRemainingSeconds;

    this.publishToAuction(auctionId, 'auction:timer:sync', {
      auctionId,
      remaining: newRemainingSeconds,
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
    if (state && state.isPaused) {
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
    if (this.timerState.has(auctionId)) {
      this.timerState.delete(auctionId);
    }
    // Notify clients timer stopped
    this.publishToAuction(auctionId, 'auction:timer:stopped', {
      auctionId,
      timestamp: new Date().toISOString(),
    });
  }

  shutdown() {
    for (const [auctionId, interval] of this.activeTimers.entries()) {
      clearInterval(interval);
    }
    this.activeTimers.clear();
    this.timerState.clear();
  }
}

// Singleton holder
let publisherInstance = null;

export function initSocketPublisher(io) {
  if (publisherInstance) return publisherInstance;
  publisherInstance = new SocketEventPublisher(io);
  publisherInstance.init();
  return publisherInstance;
}

export function getSocketPublisher() {
  return publisherInstance;
}

export default SocketEventPublisher;