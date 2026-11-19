/**
 * auction.events.js — Domain Events Definition + Emit Helpers
 * ----------------------------------------------------------------
 * Single source of truth for auction domain events.
 * Services call emitXxx() helpers AFTER DB transaction commits.
 * Publishers (socket.publisher) subscribe to these.
 *
 * This layer does NOT know about socket.io — only eventBus.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import eventBus from './eventBus.js';
import { toTransportDTO } from '../utils/transport-serializer.js'; // ← NEW
// A command's post-commit batch shares its monotonic transport revision.
// AsyncLocalStorage prevents overlapping auctions/requests from borrowing one
// another's revision, including round/completion cascades with no liveState DTO.
const commandEvents = new AsyncLocalStorage();
export function withAuctionEventVersion(auctionId, version, work) {
  return commandEvents.run({ auctionId: String(auctionId), version }, work);
}

/**
 * All domain events in the auction bounded context
 * Naming: {aggregate}:{action} in past-tense where possible
 */
export const AUCTION_EVENTS = Object.freeze({
  // Auction lifecycle
  AUCTION_CREATED: 'auction:created',
  ACTION_RECORDED: 'auction:action:recorded',
  ACTION_UNDONE: 'auction:action:undone',
  AUCTION_STARTED: 'auction:started',
  AUCTION_PAUSED: 'auction:paused',
  AUCTION_RESUMED: 'auction:resumed',
  AUCTION_COMPLETED: 'auction:completed',
  AUCTION_RULES_UPDATED: 'auction:rules:updated',

  // Round lifecycle
  ROUND_ADDED: 'auction:round:added',
  ROUND_UPDATED: 'auction:round:updated',
  ROUND_DELETED: 'auction:round:deleted',
  ROUND_STARTED: 'auction:round:started',
  ROUND_COMPLETED: 'auction:round:completed',

  // Lot lifecycle
  LOT_OPENED: 'auction:lot:opened',
  LOT_SOLD: 'auction:lot:sold',
  LOT_UNSOLD: 'auction:lot:unsold',
  LOT_PERMANENT_UNSOLD: 'auction:lot:permanent_unsold',
  LIVE_STATE_UPDATED: 'auction:liveState:updated',

  // Bidding
  BID_PLACED: 'auction:bid:placed',
  BID_OUTBID: 'auction:bid:outbid',

  // Presence
  VIEWER_JOINED: 'auction:viewer:joined',
  VIEWER_LEFT: 'auction:viewer:left',
  VIEWER_COUNT_UPDATED: 'auction:viewer:count:updated',

  // Timer (server authoritative)
  TIMER_TICK: 'auction:timer:tick',
  TIMER_SYNC: 'auction:timer:sync',
  TIMER_EXPIRED: 'auction:timer:expired',
});

/**
 * Generic emitter — all helpers use this
 */
function emitAuctionEvent(eventName, auctionId, data = {}) {
  if (!auctionId) {
    console.warn(`[auction.events] Missing auctionId for ${eventName}`);
    return false;
  }
  const context = commandEvents.getStore();
  const version = data.version ?? data.liveState?.version ?? data.auction?.liveState?.version
    ?? (context?.auctionId === String(auctionId) ? context.version : undefined);
  return eventBus.safeEmit(eventName, toTransportDTO({
    auctionId: String(auctionId), ...data, ...(version !== undefined ? { version } : {}),
  }));
}

// ===================== HELPER EMITTERS =====================

export function emitAuctionCreated(auctionId, payload) {
  return emitAuctionEvent(AUCTION_EVENTS.AUCTION_CREATED, auctionId, payload);
}

export function emitAuctionStarted(auctionId, { auction, tournamentId, startedBy } = {}) {
  return emitAuctionEvent(AUCTION_EVENTS.AUCTION_STARTED, auctionId, {
    auction,
    tournamentId,
    startedBy,
  });
}

export function emitAuctionPaused(auctionId, payload) {
  return emitAuctionEvent(AUCTION_EVENTS.AUCTION_PAUSED, auctionId, payload);
}

export function emitAuctionResumed(auctionId, payload) {
  return emitAuctionEvent(AUCTION_EVENTS.AUCTION_RESUMED, auctionId, payload);
}

export function emitAuctionCompleted(auctionId, payload) {
  return emitAuctionEvent(AUCTION_EVENTS.AUCTION_COMPLETED, auctionId, payload);
}

export function emitRulesUpdated(auctionId, payload) {
  return emitAuctionEvent(AUCTION_EVENTS.AUCTION_RULES_UPDATED, auctionId, payload);
}

export function emitRoundAdded(auctionId, payload) {
  return emitAuctionEvent(AUCTION_EVENTS.ROUND_ADDED, auctionId, payload);
}

export function emitRoundUpdated(auctionId, payload) {
  return emitAuctionEvent(AUCTION_EVENTS.ROUND_UPDATED, auctionId, payload);
}

export function emitRoundDeleted(auctionId, payload) {
  return emitAuctionEvent(AUCTION_EVENTS.ROUND_DELETED, auctionId, payload);
}

export function emitRoundCompleted(roundId, auctionId, payload) {
  return emitAuctionEvent(AUCTION_EVENTS.ROUND_COMPLETED, auctionId, {
    roundId,
    ...payload,
  });
}

export function emitLotOpened(auctionId, {
  tournamentPlayerId,
  roundId,
  currentPlayer,
  currentRound,
  liveState,
  openedBy,
  logs,
} = {}) {
  return emitAuctionEvent(AUCTION_EVENTS.LOT_OPENED, auctionId, {
    tournamentPlayerId,
    roundId,
    currentPlayer,
    currentRound,
    liveState,
    openedBy,
    logs,
  });
}

export function emitLiveStateUpdated(auctionId, liveState, meta = {}) {
  return emitAuctionEvent(AUCTION_EVENTS.LIVE_STATE_UPDATED, auctionId, {
    liveState,
    ...meta,
  });
}

export function emitBidPlaced(auctionId, {
  bid,
  tournamentPlayerId,
  roundId,
  amount,
  teamId,
  teamName,
  previousHighestBid,
  previousHighestTeamId,
  liveState,
  placedBy,
  bidCount,
} = {}) {
  return emitAuctionEvent(AUCTION_EVENTS.BID_PLACED, auctionId, {
    bid,
    tournamentPlayerId,
    roundId,
    amount,
    teamId,
    teamName,
    previousHighestBid,
    previousHighestTeamId,
    liveState,
    placedBy,
    bidCount,
  });
}

export function emitLotSold(auctionId, {
  tournamentPlayerId,
  roundId,
  soldPrice,
  soldToTeamId,
  soldToTeamName,
  liveState,
  settledBy,
} = {}) {
  return emitAuctionEvent(AUCTION_EVENTS.LOT_SOLD, auctionId, {
    tournamentPlayerId,
    roundId,
    soldPrice,
    soldToTeamId,
    soldToTeamName,
    liveState,
    settledBy,
  });
}

export function emitLotUnsold(auctionId, {
  tournamentPlayerId,
  roundId,
  liveState,
  settledBy,
} = {}) {
  return emitAuctionEvent(AUCTION_EVENTS.LOT_UNSOLD, auctionId, {
    tournamentPlayerId,
    roundId,
    liveState,
    settledBy,
  });
}

export function emitLotPermanentUnsold(auctionId, {
  tournamentPlayerId,
  roundId,
  markedBy,
  version,
} = {}) {
  return emitAuctionEvent(AUCTION_EVENTS.LOT_PERMANENT_UNSOLD, auctionId, {
    tournamentPlayerId,
    roundId,
    markedBy,
    version,
  });
}

export function emitViewerJoined(auctionId, { viewerId, userId, viewerCount } = {}) {
  return emitAuctionEvent(AUCTION_EVENTS.VIEWER_JOINED, auctionId, {
    viewerId,
    userId,
    viewerCount,
  });
}

export function emitViewerLeft(auctionId, { viewerId, viewerCount } = {}) {
  return emitAuctionEvent(AUCTION_EVENTS.VIEWER_LEFT, auctionId, {
    viewerId,
    viewerCount,
  });
}

export function emitViewerCountUpdated(auctionId, viewerCount, meta = {}) {
  return emitAuctionEvent(AUCTION_EVENTS.VIEWER_COUNT_UPDATED, auctionId, {
    viewerCount,
    ...meta,
  });
}

export default AUCTION_EVENTS;
export function emitActionRecorded(auctionId, payload) {
  return emitAuctionEvent(AUCTION_EVENTS.ACTION_RECORDED, auctionId, payload);
}
export function emitActionUndone(auctionId, payload) {
  return emitAuctionEvent(AUCTION_EVENTS.ACTION_UNDONE, auctionId, payload);
}
