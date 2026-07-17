// ============================================================================
// Auction Feature — Type Definitions
// Now aligned with backend Mongoose schema (_id → id mapping happens in API)
// ============================================================================

export type AuctionStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "paused"
  | "completed";

export type RoundStatus = "pending" | "active" | "completed";

export type RoundType =
  | "marquee"
  | "capped"
  | "uncapped"
  | "overseas"
  | "accelerated";

export type PlayerRole = "Batter" | "Bowler" | "All-Rounder" | "Wicket-Keeper";

export type PlayerStatus = "pending" | "current" | "sold" | "unsold";

export interface PlayerStats {
  matches: number;
  runs: number;
  wickets: number;
  average: number;
  strikeRate: number;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  country: string;
  overseas: boolean;
  age: number;
  basePrice: number; // in lakhs
  soldPrice?: number; // in lakhs
  teamId?: string;
  status: PlayerStatus;
  stats: PlayerStats;
  tag?: "marquee" | "star" | "uncapped";
  avatarSeed: string;
}

export interface AuctionRound {
  id: string;
  auctionId: string;
  name: string;
  // Backend AuctionRound.js stores `type` as free text (default: "normal",
  // maxlength 40) with no enum constraint — RoundType only documents the
  // values the UI has copy/styling for via RoundTypeBadge. Widened so
  // "normal" and any other organizer-entered label round-trips without
  // lying to the type checker.
  type: RoundType | (string & {});
  order: number;
  status: RoundStatus;
  playerIds: string[];
}

export interface Franchise {
  id: string;
  name: string;
  shortName: string;
  owner: string;
  colorFrom: string;
  colorTo: string;
  purseTotal: number; // in lakhs
  spent: number; // in lakhs
  maxSquadSize: number;
  maxOverseas: number;
  squad: string[]; // player ids
}

export interface Bid {
  id: string;
  playerId: string;
  teamId: string;
  amount: number; // in lakhs
  timestamp: number;
  roundId: string;
  isUser?: boolean;
}

export type AuctionLogType =
  | "start"
  | "pause"
  | "resume"
  | "lot_open"
  | "bid"
  | "sold"
  | "unsold"
  | "round_complete"
  | "complete"
  | "connect"
  | "disconnect";

export interface AuctionLog {
  id: string;
  type: AuctionLogType;
  message: string;
  timestamp: number;
}

export interface BidIncrementTier {
  upTo: number | null; // lakhs, null = infinity
  increment: number; // lakhs
}

export interface AuctionRules {
  bidIncrements: BidIncrementTier[];
  lotTimerSeconds: number;
  bidResetSeconds: number;
  pursePerTeam: number;
  maxSquadSize: number;
  maxOverseas: number;
}

export interface Auction {
  id: string;
  name: string;
  tournamentName: string;
  organizer: string;
  status: AuctionStatus;
  scheduledAt: string;
  season: string;
  rules: AuctionRules;
  createdAt: string;
  tournamentId?: string;
}

export interface TimerState {
  remaining: number;
  total: number;
  isRunning: boolean;
}

export interface CurrentBidState {
  amount: number;
  teamId: string | null;
}

/** Full snapshot broadcast by the live-auction engine on every mutation. */
export interface LiveAuctionSnapshot {
  auction: Auction;
  rounds: AuctionRound[];
  players: Player[];
  franchises: Franchise[];
  status: AuctionStatus;
  currentRoundId: string | null;
  currentPlayerId: string | null;
  currentBid: CurrentBidState;
  timer: TimerState;
  bidHistory: Bid[];
  logs: AuctionLog[];
  soldEvent: { playerId: string; teamId: string; amount: number; seq: number } | null;
  unsoldEvent: { playerId: string; seq: number } | null;
  connection: "connecting" | "connected" | "reconnecting" | "offline";
  serverLatencyMs: number;
  playersSoldCount: number;
  playersUnsoldCount: number;
  totalMoneySpent: number;
  viewerCount: number; // NEW: pushed via Socket.IO in real-time
}

/**
 * Shape returned by GET /auctions/:id/snapshot (see auctionApi.getSnapshot).
 * This is the REST-poll equivalent of LiveAuctionSnapshot.
 */
export interface AuctionSnapshot {
  auction: Auction;
  rounds: AuctionRound[];
  players: Player[];
  franchises: Franchise[];
  bidHistory: Bid[];
  logs: AuctionLog[];
  status: AuctionStatus;
  currentRoundId: string | null;
  currentPlayerId: string | null;
  currentBid: CurrentBidState;
  timer: TimerState;
  lotStatus: "PENDING" | "BIDDING" | "SOLD" | "UNSOLD";
  version: number;
  generatedAt: string;
  viewerCount: number;
}

export interface AuctionPermissions {
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canOpenLot: boolean;
  canComplete: boolean;
  canBid: boolean;
  canMarkSold: boolean;
  canMarkUnsold: boolean;
}

// ---------------------------------------------------------------------------
// API contract types (backend returns these wrappers)
// ---------------------------------------------------------------------------
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
}