// Single source of truth for every enum used across models and services.
// v2 — reconciled against the actual service-layer implementations
// (see /outputs/SERVICE_ALIGNMENT_NOTES.md for what changed and why).

export const USER_ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  ORGANIZER: 'ORGANIZER',
  FRANCHISE_OWNER: 'FRANCHISE_OWNER',
  PLAYER: 'PLAYER',
});

export const TOURNAMENT_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PLAYER_REGISTRATION_OPEN: 'PLAYER_REGISTRATION_OPEN',
  TEAM_REGISTRATION_OPEN: 'TEAM_REGISTRATION_OPEN',
  TEAMS_APPROVED: 'TEAMS_APPROVED',
  TEAMS_REJECTED: 'TEAMS_REJECTED',
  AUCTION_SCHEDULED: 'AUCTION_SCHEDULED',
  AUCTION_RUNNING: 'AUCTION_RUNNING',
  AUCTION_COMPLETED: 'AUCTION_COMPLETED',
  TOURNAMENT_COMPLETED: 'TOURNAMENT_COMPLETED',
  CANCELLED: 'CANCELLED',
});

// Explicit adjacency list so illegal jumps fail loudly via Tournament.transitionTo().
// Note: player verification and team approval happen at the entity level
// (TournamentPlayer.status / TournamentTeam.status), not as tournament-wide
// gates — that's why there's no separate PLAYER_VERIFICATION tournament status.
export const TOURNAMENT_TRANSITIONS = Object.freeze({
  [TOURNAMENT_STATUS.DRAFT]: [TOURNAMENT_STATUS.PLAYER_REGISTRATION_OPEN, TOURNAMENT_STATUS.CANCELLED],
  [TOURNAMENT_STATUS.PLAYER_REGISTRATION_OPEN]: [TOURNAMENT_STATUS.TEAM_REGISTRATION_OPEN, TOURNAMENT_STATUS.CANCELLED],
  [TOURNAMENT_STATUS.TEAM_REGISTRATION_OPEN]: [TOURNAMENT_STATUS.TEAMS_APPROVED, TOURNAMENT_STATUS.CANCELLED],
  [TOURNAMENT_STATUS.TEAMS_APPROVED]: [TOURNAMENT_STATUS.AUCTION_SCHEDULED, TOURNAMENT_STATUS.CANCELLED],
  [TOURNAMENT_STATUS.TEAMS_REJECTED]: [TOURNAMENT_STATUS.CANCELLED],
  [TOURNAMENT_STATUS.AUCTION_SCHEDULED]: [TOURNAMENT_STATUS.AUCTION_RUNNING],
  [TOURNAMENT_STATUS.AUCTION_RUNNING]: [TOURNAMENT_STATUS.AUCTION_COMPLETED],
  [TOURNAMENT_STATUS.AUCTION_COMPLETED]: [TOURNAMENT_STATUS.TOURNAMENT_COMPLETED],
  [TOURNAMENT_STATUS.TOURNAMENT_COMPLETED]: [],
  [TOURNAMENT_STATUS.CANCELLED]: [],
});

export const REGISTRATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

// Auction outcome tracked separately from registration status so a player can
// be APPROVED (registration) yet UNSOLD (auction) and re-listed in a later
// round without corrupting the verification trail.
export const LOT_OUTCOME = Object.freeze({
  NOT_LISTED: 'NOT_LISTED',
  IN_PROGRESS: 'IN_PROGRESS',
  SOLD: 'SOLD',
  UNSOLD: 'UNSOLD',
  PERMANENT_UNSOLD: 'PERMANENT_UNSOLD',
});

export const PLAYER_ROLES = Object.freeze({
  BATSMAN: 'BATSMAN',
  BOWLER: 'BOWLER',
  ALL_ROUNDER: 'ALL_ROUNDER',
  WICKET_KEEPER: 'WICKET_KEEPER',
});

export const AUCTION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  LIVE: 'LIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
});

// DRAFT can go straight to LIVE (skip explicit scheduling) or via SCHEDULED —
// both are legitimate organizer workflows the service layer supports.
export const AUCTION_TRANSITIONS = Object.freeze({
  [AUCTION_STATUS.DRAFT]: [AUCTION_STATUS.SCHEDULED, AUCTION_STATUS.LIVE],
  [AUCTION_STATUS.SCHEDULED]: [AUCTION_STATUS.LIVE],
  [AUCTION_STATUS.LIVE]: [AUCTION_STATUS.PAUSED, AUCTION_STATUS.COMPLETED],
  [AUCTION_STATUS.PAUSED]: [AUCTION_STATUS.LIVE],
  [AUCTION_STATUS.COMPLETED]: [],
});

export const LOT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  BIDDING: 'BIDDING',
  SOLD: 'SOLD',
  UNSOLD: 'UNSOLD',
  PERMANENT_UNSOLD: 'PERMANENT_UNSOLD'
});

// ------------------------------------------------------------------
// ROUND_TYPE
// ------------------------------------------------------------------

export const ROUND_TYPE = Object.freeze({
  NORMAL: 'normal',
  UNSOLD: 'unsold',
});

export const ROUND_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
});

// WINNING doubles as "currently the highest bid" while a lot is open and as
// the permanent final state once the lot settles SOLD — a bid that won
// never needs a different status after settlement, so there's no separate
// VALID/WINNING split. OUTBID is terminal once superseded.
export const BID_STATUS = Object.freeze({
  WINNING: 'WINNING',
  OUTBID: 'OUTBID',
  CANCELLED: 'CANCELLED',
});

export const AUCTION_LOG_ACTIONS = Object.freeze({
  AUCTION_CREATED: 'AUCTION_CREATED',
  ROUND_ADDED: 'ROUND_ADDED',
  ROUND_UPDATED: 'ROUND_UPDATED',
  ROUND_DELETED: 'ROUND_DELETED',
  ROUND_STARTED: 'ROUND_STARTED',
  ROUND_COMPLETED: 'ROUND_COMPLETED',
  RULES_UPDATED: 'RULES_UPDATED',
  AUCTION_STARTED: 'AUCTION_STARTED',
  AUCTION_PAUSED: 'AUCTION_PAUSED',
  AUCTION_RESUMED: 'AUCTION_RESUMED',
  AUCTION_COMPLETED: 'AUCTION_COMPLETED',
  LOT_OPENED: 'LOT_OPENED',
  BID_PLACED: 'BID_PLACED',
  LOT_SOLD: 'LOT_SOLD',
  LOT_UNSOLD: 'LOT_UNSOLD',
  UNSOLD_ROUND_CREATED: 'UNSOLD_ROUND_CREATED',
  PERMANENT_UNSOLD_MARKED: 'PERMANENT_UNSOLD_MARKED',
});
 

export const NOTIFICATION_TYPES = Object.freeze({
  SYSTEM: 'SYSTEM',
  REGISTRATION_UPDATE: 'REGISTRATION_UPDATE',
  TEAM_UPDATE: 'TEAM_UPDATE',
  AUCTION_UPDATE: 'AUCTION_UPDATE',
  BID_UPDATE: 'BID_UPDATE',
});

export const NOTIFICATION_PRIORITY = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
});