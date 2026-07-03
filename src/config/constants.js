export const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  ORGANIZER: 'organizer',
  FRANCHISE_OWNER: 'franchise_owner',
  PLAYER: 'player',
});

export const TOURNAMENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  REGISTRATION_OPEN: 'registration_open',
  TEAMS_APPROVED: 'teams_approved',
  AUCTION_SCHEDULED: 'auction_scheduled',
  LIVE: 'live',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
});

export const REGISTRATION_STATUS = Object.freeze({
  PENDING: 'pending',
  VERIFIED: 'verified',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const AUCTION_STATUS = Object.freeze({
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  PAUSED: 'paused',
  COMPLETED: 'completed',
});

export const LOT_STATUS = Object.freeze({
  PENDING: 'pending',
  ON_BLOCK: 'on_block',
  BIDDING: 'bidding',
  SOLD: 'sold',
  UNSOLD: 'unsold',
});

export const ROUND_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
});

export const BID_STATUS = Object.freeze({
  VALID: 'valid',
  OUTBID: 'outbid',
  WINNING: 'winning',
  REJECTED: 'rejected',
});

export const NOTIFICATION_TYPES = Object.freeze({
  REGISTRATION: 'registration',
  AUCTION: 'auction',
  BID: 'bid',
  SYSTEM: 'system',
});

export const PLAYER_ROLES = Object.freeze({
  BATSMAN: 'batsman',
  BOWLER: 'bowler',
  ALL_ROUNDER: 'all_rounder',
  WICKET_KEEPER: 'wicket_keeper',
});

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const AUCTION_LOG_ACTIONS = Object.freeze({
  AUCTION_CREATED: 'auction_created',
  AUCTION_STARTED: 'auction_started',
  AUCTION_PAUSED: 'auction_paused',
  AUCTION_RESUMED: 'auction_resumed',
  AUCTION_COMPLETED: 'auction_completed',
  LOT_OPENED: 'lot_opened',
  BID_PLACED: 'bid_placed',
  LOT_SOLD: 'lot_sold',
  LOT_UNSOLD: 'lot_unsold',
  ROUND_STARTED: 'round_started',
  ROUND_COMPLETED: 'round_completed',
});
