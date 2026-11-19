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

import eventBus from "../events/eventBus.js";
import { AUCTION_EVENTS } from "../events/auction.events.js";

class SocketEventPublisher {
  constructor(io) {
    this.io = io;
    // auctionId -> intervalId
    this.activeTimers = new Map();
    // auctionId -> { remaining, total, lotStatus, expiresAt, version }
    this.timerState = new Map();
    this.isListening = false;
    this.domainListeners = new Map();
    this.revisions = new Map();
  }

  /**
   * Start listening to domain events — call once after io init
   */
  init() {
    if (this.isListening) return;
    this.isListening = true;

    // Journal corrections are room-scoped and visible to anonymous viewers too.
    this.listen(AUCTION_EVENTS.ACTION_RECORDED, (payload) => this.handleActionRecorded(payload));
    this.listen(AUCTION_EVENTS.ACTION_UNDONE, (payload) => this.handleActionUndone(payload));

    // Auction lifecycle
    this.listen(AUCTION_EVENTS.AUCTION_CREATED, (p) =>
      this.handleAuctionCreated(p),
    );
    this.listen(AUCTION_EVENTS.AUCTION_STARTED, (p) =>
      this.handleAuctionStarted(p),
    );
    this.listen(AUCTION_EVENTS.AUCTION_PAUSED, (p) =>
      this.handleAuctionPaused(p),
    );
    this.listen(AUCTION_EVENTS.AUCTION_RESUMED, (p) =>
      this.handleAuctionResumed(p),
    );
    this.listen(AUCTION_EVENTS.AUCTION_COMPLETED, (p) =>
      this.handleAuctionCompleted(p),
    );
    this.listen(AUCTION_EVENTS.AUCTION_RULES_UPDATED, (p) =>
      this.handleRulesUpdated(p),
    );

    // Round
    this.listen(AUCTION_EVENTS.ROUND_ADDED, (p) => this.handleRoundAdded(p));
    this.listen(AUCTION_EVENTS.ROUND_UPDATED, (p) =>
      this.handleRoundUpdated(p),
    );
    this.listen(AUCTION_EVENTS.ROUND_DELETED, (p) =>
      this.handleRoundDeleted(p),
    );
    this.listen(AUCTION_EVENTS.ROUND_COMPLETED, (p) =>
      this.handleRoundCompleted(p),
    );

    // Lot
    this.listen(AUCTION_EVENTS.LOT_OPENED, (p) => this.handleLotOpened(p));
    this.listen(AUCTION_EVENTS.LOT_SOLD, (p) => this.handleLotSold(p));
    this.listen(AUCTION_EVENTS.LOT_UNSOLD, (p) => this.handleLotUnsold(p));
    this.listen(AUCTION_EVENTS.LOT_PERMANENT_UNSOLD, (p) =>
      this.handleLotPermanentUnsold(p),
    );
    this.listen(AUCTION_EVENTS.LIVE_STATE_UPDATED, (p) =>
      this.handleLiveStateUpdated(p),
    );

    // Bidding
    this.listen(AUCTION_EVENTS.BID_PLACED, (p) => this.handleBidPlaced(p));

    // Presence
    this.listen(AUCTION_EVENTS.VIEWER_COUNT_UPDATED, (p) =>
      this.handleViewerCountUpdated(p),
    );
    this.listen(AUCTION_EVENTS.VIEWER_JOINED, (p) =>
      this.handleViewerJoined(p),
    );
    this.listen(AUCTION_EVENTS.VIEWER_LEFT, (p) => this.handleViewerLeft(p));

    console.log("[SocketPublisher] Listening to auction domain events");
  }

  listen(event, handler) {
    const listener = (payload) => {
      const version = payload.version ?? payload.liveState?.version ?? payload.auction?.liveState?.version;
      const key = String(payload.auctionId);
      if (Number.isFinite(version)) {
        if (version < (this.revisions.get(key) ?? -1)) return;
        this.revisions.delete(key);
        this.revisions.set(key, version);
        // Bounded worker-local high watermarks. Clients also fence revisions,
        // including timers broadcast by a different Redis-adapter worker.
        if (this.revisions.size > 10_000) this.revisions.delete(this.revisions.keys().next().value);
      }
      handler(payload);
    };
    this.domainListeners.set(event, listener);
    eventBus.on(event, listener);
  }

  clockRemaining(remaining, liveState) {
    const elapsed = liveState?.updatedAt ? Math.max(0, (Date.now() - new Date(liveState.updatedAt).getTime()) / 1000) : 0;
    return Math.max(0, (remaining ?? 0) - elapsed);
  }

  /**
   * Lightweight transport sanitizer — transport layer only.
   *
   * Guards against:
   * - Circular references
   * - Functions / Symbols
   * - Unexpected non-serializable values
   *
   * Does NOT know about Mongoose. All Mongoose→DTO conversion
   * happens upstream in the event layer (auction.events.js).
   */
  sanitizePayload(obj, seen = new WeakSet()) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== "object") {
      if (typeof obj === "function" || typeof obj === "symbol")
        return undefined;
      return obj;
    }
    if (obj instanceof Date) return obj.toISOString();

    if (Array.isArray(obj)) {
      const out = [];
      for (const item of obj) {
        const converted = this.sanitizePayload(item, seen);
        if (converted !== undefined) out.push(converted);
      }
      return out;
    }

    // Circular guard
    if (seen.has(obj)) return "[Circular]";
    seen.add(obj);

    const out = {};
    for (const key of Object.keys(obj)) {
      const converted = this.sanitizePayload(obj[key], seen);
      if (converted !== undefined) out[key] = converted;
    }

    seen.delete(obj);
    return out;
  }

  publishToAuction(auctionId, socketEvent, payload) {
    const version = payload.version ?? payload.liveState?.version ?? payload.auction?.liveState?.version;
    if (Number.isFinite(version) && version < (this.revisions.get(String(auctionId)) ?? -1)) return;
    try {
      const room = `auction:${auctionId}`;
     

      const safePayload = this.sanitizePayload(payload);

      // DEV smoke test: scream if something upstream still escaped
      if (process.env.NODE_ENV !== "production") {
        try {
          JSON.stringify(safePayload);
        } catch (err) {
          console.error(
            `[SocketPublisher] NON-SERIALIZABLE payload escaped sanitization for ${socketEvent}:`,
            err.message,
          );
        }
      }

      this.io.to(room).emit(socketEvent, safePayload);

      // This fires on every publish — including timer ticks every second —
      // so keep it behind the debug flag instead of spamming production logs.
      if (process.env.DEBUG_SOCKET) {
        const roomInfo = this.io.sockets.adapter.rooms.get(room);
        const connectedClients = roomInfo ? roomInfo.size : 0;
        console.log({
          room,
          event: socketEvent,
          connectedClients,
          payloadKeys: Object.keys(safePayload),
        });
        console.log(
          `[SocketPublisher] -> ${room} :: ${socketEvent}`,
          safePayload?.auctionId || "",
        );
      }
    } catch (err) {
      console.error(
        `[SocketPublisher] Failed to publish ${socketEvent} for ${auctionId}`,
        err,
      );
    }
  }

  publishToAll(socketEvent, payload) {
    try {
      const safePayload = this.sanitizePayload(payload);
      this.io.emit(socketEvent, safePayload);
    } catch (err) {
      console.error(
        `[SocketPublisher] Failed to publish ${socketEvent} globally`,
        err,
      );
    }
  }

  // ---------- Auction handlers ----------
  handleActionRecorded(payload) {
    this.publishToAuction(payload.auctionId, "auction:action:recorded", payload);
    // Any command advances the revision, even a round rename. Re-anchor from
    // the persisted clock so timer syncs never carry a superseded revision or
    // add network/notification latency to the bidding window.
    if (payload.status === 'LIVE' && payload.liveState?.lotStatus === 'BIDDING') {
      this.startTimer(payload.auctionId, payload.liveState.remainingTimeSeconds, {
        ...payload.liveState, lotTimerSeconds: payload.lotTimerSeconds,
      });
    } else {
      this.stopTimer(payload.auctionId, payload.version);
    }
  }

  handleActionUndone(payload) {
    const { auctionId, auction, liveState } = payload;
    this.stopTimer(auctionId, payload.version);
    // Publish the correction before any timer sync; clients must adopt the
    // recovered PAUSED/LIVE status before they decide whether to count down.
    this.publishToAuction(auctionId, "auction:action:undone", payload);
    if (liveState?.lotStatus === 'BIDDING' && auction?.status === 'LIVE') {
      this.startTimer(auctionId, liveState.remainingTimeSeconds, { ...liveState, lotTimerSeconds: auction.lotTimerSeconds });
    }
  }

  handleAuctionCreated({
    auctionId,
    auction,
    tournamentId,
    createdBy,
    _emittedAt,
  }) {
    this.publishToAuction(auctionId, "auction:created", {
      auctionId,
      auction,
      tournamentId,
      createdBy,
      timestamp: _emittedAt,
    });
  }

  handleAuctionStarted({
    auctionId,
    auction,
    tournamentId,
    startedBy,
    _emittedAt,
  }) {
    this.stopTimer(auctionId, auction?.liveState?.version); // clear any stale timer
    this.publishToAuction(auctionId, "auction:started", {
      auctionId,
      auction,
      tournamentId,
      startedBy,
      timestamp: _emittedAt,
    });
    this.publishToAuction(auctionId, "auction:log", {
      auctionId,
      action: "AUCTION_STARTED",
      message: "Auction started",
      timestamp: _emittedAt,
      userId: startedBy,
    });
  }

  handleAuctionPaused({ auctionId, auction, pausedBy, _emittedAt }) {
    this.stopTimer(auctionId, auction?.liveState?.version);
    this.publishToAuction(auctionId, "auction:paused", {
      auctionId,
      auction,
      pausedBy,
      timestamp: _emittedAt,
    });
  }

  handleAuctionResumed({ auctionId, auction, resumedBy, _emittedAt }) {
    this.publishToAuction(auctionId, "auction:resumed", {
      auctionId, auction, resumedBy, timestamp: _emittedAt,
    });
    const live = auction?.liveState;
    if (live?.lotStatus === 'BIDDING') {
      this.startTimer(auctionId, live.remainingTimeSeconds, { ...live, lotTimerSeconds: auction.lotTimerSeconds });
    }
  }

  handleAuctionCompleted({ auctionId, auction, completedBy, _emittedAt }) {
    this.stopTimer(auctionId, auction?.liveState?.version);
    this.publishToAuction(auctionId, "auction:completed", {
      auctionId,
      auction,
      completedBy,
      timestamp: _emittedAt,
    });
    // optional global broadcast for lobby screens
    this.publishToAll("auction:global:completed", {
      auctionId,
      timestamp: _emittedAt,
    });
  }

  handleRulesUpdated({ auctionId, patch, updatedBy, auction, _emittedAt }) {
    this.publishToAuction(auctionId, "auction:rules:updated", {
      auctionId,
      patch,
      auction,
      updatedBy,
      timestamp: _emittedAt,
    });
  }

  // ---------- Round handlers ----------
  handleRoundAdded({ auctionId, round, _emittedAt, version }) {
    this.publishToAuction(auctionId, "auction:round:added", {
      auctionId,
      version,
      round,
      timestamp: _emittedAt,
    });
  }

  handleRoundUpdated({ auctionId, round, patch, _emittedAt, version }) {
    this.publishToAuction(auctionId, "auction:round:updated", {
      auctionId,
      version,
      round,
      patch,
      timestamp: _emittedAt,
    });
  }

  handleRoundDeleted({ auctionId, roundId, roundName, _emittedAt, version }) {
    this.publishToAuction(auctionId, "auction:round:deleted", {
      auctionId,
      version,
      roundId,
      roundName,
      timestamp: _emittedAt,
    });
  }

  handleRoundCompleted({ auctionId, roundId, round, _emittedAt, version }) {
    this.publishToAuction(auctionId, "auction:round:completed", {
      auctionId,
      version,
      roundId,
      round,
      timestamp: _emittedAt,
    });
  }

  // ---------- Lot handlers ----------
  handleLotOpened({
    auctionId,
    tournamentPlayerId,
    roundId,
    currentPlayer,
    currentRound,
    liveState,
    openedBy,
    _emittedAt,
  }) {
    // Start authoritative timer
    const total = liveState?.remainingTimeSeconds || 0;
    this.startTimer(auctionId, total, liveState);

    this.publishToAuction(auctionId, "auction:lot:opened", {
      auctionId,
      tournamentPlayerId,
      roundId,
      currentPlayer,
      currentRound,
      liveState: {
        ...liveState,
        _serverTime: _emittedAt,
        _expiresAt: new Date(
          new Date(_emittedAt).getTime() + total * 1000,
        ).toISOString(),
      },
      openedBy,
      timestamp: _emittedAt,
    });

    this.publishToAuction(auctionId, "auction:liveState", {
      auctionId,
      liveState,
      trigger: "LOT_OPENED",
      timestamp: _emittedAt,
    });
  }

  handleLotSold({
    auctionId,
    tournamentPlayerId,
    roundId,
    soldPrice,
    soldToTeamId,
    soldToTeamName,
    liveState,
    settledBy,
    _emittedAt,
  }) {
    this.stopTimer(auctionId, liveState?.version);
    this.publishToAuction(auctionId, "auction:lot:sold", {
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
    this.publishToAuction(auctionId, "auction:liveState", {
      auctionId,
      liveState,
      trigger: "LOT_SOLD",
      timestamp: _emittedAt,
    });
  }

  handleLotUnsold({
    auctionId,
    tournamentPlayerId,
    roundId,
    liveState,
    settledBy,
    _emittedAt,
  }) {
    this.stopTimer(auctionId, liveState?.version);
    this.publishToAuction(auctionId, "auction:lot:unsold", {
      auctionId,
      tournamentPlayerId,
      roundId,
      liveState,
      settledBy,
      timestamp: _emittedAt,
    });
    this.publishToAuction(auctionId, "auction:liveState", {
      auctionId,
      liveState,
      trigger: "LOT_UNSOLD",
      timestamp: _emittedAt,
    });
  }

  handleLotPermanentUnsold({
    auctionId,
    tournamentPlayerId,
    roundId,
    markedBy,
    version,
    _emittedAt,
  }) {
    this.publishToAuction(auctionId, "auction:lot:permanent_unsold", {
      auctionId,
      tournamentPlayerId,
      roundId,
      markedBy,
      version,
      timestamp: _emittedAt,
    });
    this.publishToAuction(auctionId, "auction:log", {
      auctionId,
      action: "PERMANENT_UNSOLD_MARKED",
      message: `Player ${tournamentPlayerId} marked permanently unsold`,
      metadata: { tournamentPlayerId, roundId },
      timestamp: _emittedAt,
      userId: markedBy,
    });
  }

  handleLiveStateUpdated({ auctionId, liveState, trigger, _emittedAt }) {
    this.publishToAuction(auctionId, "auction:liveState", {
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
    this.publishToAuction(auctionId, "auction:bid:placed", {
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
    this.publishToAuction(auctionId, "auction:liveState", {
      auctionId,
      liveState,
      trigger: "BID_PLACED",
      timestamp: _emittedAt,
    });

    // 3) Log entry
    this.publishToAuction(auctionId, "auction:log", {
      auctionId,
      action: "BID_PLACED",
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
    this.publishToAuction(auctionId, "auction:viewer:count", {
      auctionId,
      viewerCount,
      timestamp: _emittedAt,
    });
  }

  handleViewerJoined({ auctionId, viewerId, userId, viewerCount, _emittedAt }) {
    this.publishToAuction(auctionId, "auction:viewer:joined", {
      auctionId,
      viewerId,
      userId,
      viewerCount,
      timestamp: _emittedAt,
    });
  }

  handleViewerLeft({ auctionId, viewerId, viewerCount, _emittedAt }) {
    this.publishToAuction(auctionId, "auction:viewer:left", {
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
    const version = liveState.version;
    if (Number.isFinite(version) && version < (this.revisions.get(String(auctionId)) ?? -1)) return;
    this.stopTimer(auctionId, version);
    remainingSeconds = this.clockRemaining(remainingSeconds, liveState);
    const totalSeconds = liveState.lotTimerSeconds || remainingSeconds || 30;
    const expiresAt = Date.now() + remainingSeconds * 1000;
    if (remainingSeconds <= 0) {
      this.publishToAuction(auctionId, "auction:timer:expired", { auctionId, version });
      return;
    }

    this.timerState.set(auctionId, {
      remainingSeconds,
      totalSeconds,
      expiresAt,
      version: liveState?.version ?? 0,
      lotStatus: liveState?.lotStatus || "BIDDING",
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
      this.publishToAuction(auctionId, "auction:timer:tick", {
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
        this.publishToAuction(auctionId, "auction:timer:sync", {
          auctionId,
          remaining: trueRemaining,
          version: state.version,
          total: state.totalSeconds,
          serverTime: new Date().toISOString(),
          expiresAt: new Date(state.expiresAt).toISOString(),
        });
      }

      if (trueRemaining <= 0) {
        this.publishToAuction(auctionId, "auction:timer:expired", {
          auctionId,
          version: state.version,
          timestamp: new Date().toISOString(),
        });
        this.stopTimer(auctionId);
      }
    }, 1000);

    this.activeTimers.set(auctionId, interval);

    // Immediate sync on start
    this.publishToAuction(auctionId, "auction:timer:sync", {
      auctionId,
      remaining: remainingSeconds,
      version: liveState?.version,
      total: totalSeconds,
      serverTime: new Date().toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      isRunning: true,
    });
  }

  adjustTimer(auctionId, newRemainingSeconds, liveState = {}) {
    newRemainingSeconds = this.clockRemaining(newRemainingSeconds, liveState);
    const state = this.timerState.get(auctionId);
    if (!state) {
      // No active timer — start one if lot is BIDDING
      if (liveState?.lotStatus === "BIDDING") {
        this.startTimer(auctionId, liveState.remainingTimeSeconds ?? newRemainingSeconds, liveState);
      }
      return;
    }
    state.expiresAt = Date.now() + newRemainingSeconds * 1000;
    state.version = liveState?.version ?? state.version;
    state.remainingSeconds = newRemainingSeconds;

    this.publishToAuction(auctionId, "auction:timer:sync", {
      auctionId,
      remaining: newRemainingSeconds,
      total: state.totalSeconds,
      version: state.version,
      serverTime: new Date().toISOString(),
      expiresAt: new Date(state.expiresAt).toISOString(),
      reason: "BID_PLACED",
    });
  }

  stopTimer(auctionId, version = this.timerState.get(auctionId)?.version) {
    if (Number.isFinite(version) && version < (this.revisions.get(String(auctionId)) ?? -1)) return;
    if (this.activeTimers.has(auctionId)) {
      clearInterval(this.activeTimers.get(auctionId));
      this.activeTimers.delete(auctionId);
    }
    if (this.timerState.has(auctionId)) {
      this.timerState.delete(auctionId);
    }
    // Notify clients timer stopped
    this.publishToAuction(auctionId, "auction:timer:stopped", {
      auctionId,
      version,
      timestamp: new Date().toISOString(),
    });
  }

  shutdown() {
    for (const [auctionId, interval] of this.activeTimers.entries()) {
      clearInterval(interval);
    }
    this.activeTimers.clear();
    this.timerState.clear();
    for (const [event, listener] of this.domainListeners) eventBus.off(event, listener);
    this.domainListeners.clear();
    this.revisions.clear();
    this.isListening = false;
  }
}

// Singleton holder
let publisherInstance = null;

export function initSocketPublisher(io) {
  if (publisherInstance) { publisherInstance.io = io; publisherInstance.init(); return publisherInstance; }
  publisherInstance = new SocketEventPublisher(io);
  publisherInstance.init();
  return publisherInstance;
}

export function getSocketPublisher() {
  return publisherInstance;
}

export default SocketEventPublisher;
