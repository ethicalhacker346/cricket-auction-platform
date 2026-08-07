// Auction Feature — Type Definitions
// Backend authorization is authoritative. UI capability names are API aliases;
// canonical policy keys remain the source of truth internally.

import strict from "assert/strict";

export type AuctionStatus = "draft" | "scheduled" | "live" | "paused" | "completed";
export type RoundStatus = "pending" | "active" | "completed";
export type AuctionRoundType =
    | "normal"
    | "unsold";

export type AuctionRoundCategory =
    | "BATSMAN"
    | "BOWLER"
    | "ALL_ROUNDER"
    | "WICKET_KEEPER"
    | "CAPPED"
    | "UNCAPPED"
    | "OVERSEAS"
    | "MARQUEE"
    | "CUSTOM";

export type PlayerRole = "Batter" | "Bowler" | "All-Rounder" | "Wicket-Keeper";
export type PlayerStatus = "pending" | "current" | "sold" | "unsold"| "permanent_unsold";

export type AuctionPermission =
  | "MANAGE_AUCTION"
  | "UPDATE_RULES"
  | "MANAGE_ROUNDS"
  | "START_AUCTION"
  | "PAUSE_AUCTION"
  | "RESUME_AUCTION"
  | "COMPLETE_AUCTION"
  | "OPEN_LOT"
  | "SETTLE_LOT"
  | "PLACE_BID"
  | "MARK_PERMANENT_UNSOLD";

export type UserRole = "ADMIN" | "ORGANIZER" | "FRANCHISE_OWNER" | "PLAYER" | string;



export type PermissionReason =
  | "ALLOWED"
  | "USER_INACTIVE"
  | "ROLE_LACKS_CAPABILITY"
  | "NOT_RESOURCE_OWNER"
  | "AUCTION_COMPLETED"
  | "AUCTION_NOT_DRAFT_OR_SCHEDULED"
  | "AUCTION_NOT_LIVE"
  | "AUCTION_NOT_PAUSED"
  | string;

export interface AuctionPermissionDecision {
  allowed: boolean;
  reason: PermissionReason;
}

/** Exact policy payload returned by GET /auctions/:id/permissions. */
export interface AuctionPermissions {
  policyVersion: number;
  permissions: Record<AuctionPermission, boolean>;
  reasons: Record<AuctionPermission, PermissionReason>;
  ownsAuction: boolean;
  ownsTournament: boolean;
  role: UserRole;
  auctionStatus: Uppercase<AuctionStatus> | string;

  
  canManageRounds: boolean;
  canUpdateRules: boolean;

  // API-boundary aliases. These are convenience fields, never policy inputs.
  canManageAuction: boolean;
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canOpenLot: boolean;
  canComplete: boolean;
  canBid: boolean;
  canMarkSold: boolean;
  canMarkUnsold: boolean;
  canMarkPermanentUnsold: boolean;
  canAccessRoundManagement: boolean;
  canAccessAuctionControls: boolean;
  canAccessRulesEditor: boolean;


  ownsTournamentTeam: boolean;

  tournamentTeamApproved: boolean;

  tournamentTeamId: string | null;
}

export interface PlayerStats {
  matches: number;
  runs: number;
  wickets: number;
  average: number;
  strikeRate: number;
}

// Add these fields to the Player interface
export interface Player {
  id: string;
  name: string;
  fullName?: string;           // ← NEW: raw from Player.js
  role: PlayerRole;
  country: string;
  overseas: boolean;
  age: number;
  basePrice: number;
  soldPrice?: number;
  teamId?: string;
  status: PlayerStatus;
  stats: PlayerStats;
  tag?: "marquee" | "star" | "uncapped";
  avatarSeed: string;
  profileImage?: string;
  
  // ── NEW FIELDS ──
  battingStyle?: string;        // ← "Right-hand Bat", "Left-hand Bat", etc.
  bowlingStyle?: string;      // ← "Right-arm Fast", "Left-arm Spin", etc.
  bio?: string;                // ← Player biography (max 1000 chars)
  category?: string;           // ← Tournament category
  soldAt?: string;             // ← ISO timestamp when sold
  soldToTeamName?: string;     // ← Populated team name for sold state
}

// Add role icon mapping for Wicket-Keeper
// In your constants file, ensure ROLE_ICONS covers:
// "Batter" → "🏏"
// "Bowler" → "🎾" or "🏐"  
// "All-Rounder" → "⭐"
// "Wicket-Keeper" → "🧤"

export interface AuctionRound {
  id: string;
  auctionId: string;
  name: string;
  type:AuctionRoundType;
  category:AuctionRoundCategory | string;
  order: number;
  status: RoundStatus;
  playerIds: string[];
}

export interface Franchise {
  id: string;
  name: string;
  shortName: string;
  owner: string;
  ownerId: string;
  franchiseId:string;
  colorFrom: string;
  colorTo: string;
  purseTotal: number;
  spent: number;
  /** Money locked by this team's own currently-leading bid(s) — already
   *  subtracted from wallet.remainingBudget server-side (see
   *  TournamentTeam.js `reserve`/`releaseReservation`). Must be subtracted
   *  again here too when computing "remaining", or the UI overstates what
   *  the team can still spend. */
  reservedBudget: number;
  maxSquadSize: number;
  maxOverseas: number;
  squad: string[];
  /** Absolute URL, mirrors Franchise.js's `logo` validator (http(s) only).
   *  Often unset — always render with a fallback. */
  logo?: string;
  city?: string;           // ← NEW
  description?: string;  
}

export interface Bid {
  id: string;
  playerId: string;
  teamId: string;
  amount: number;
  timestamp: number;
  roundId: string;
  isUser?: boolean;
}

export type AuctionLogType =
  | "start" | "pause" | "resume" | "lot_open" | "bid" | "sold"
  | "unsold" | "round_complete" | "complete" | "connect" | "disconnect";

export interface AuctionLog {
  id: string;
  type: AuctionLogType;
  message: string;
  timestamp: number;
}

export interface BidIncrementTier {
  upTo: number | null;
  increment: number;
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

export interface TimerState { remaining: number; total: number; isRunning: boolean; }
export interface CurrentBidState { amount: number; teamId: string | null; }

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
  permanentUnsoldEvent: { playerId: string; seq: number } | null;
  connection: "connecting" | "connected" | "reconnecting" | "offline";
  serverLatencyMs: number;
  playersSoldCount: number;
  playersUnsoldCount: number;
  playersPermanentUnsoldCount : number;
  totalMoneySpent: number;
  viewerCount: number;
}

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

export interface ApiResponse<T> { success: boolean; data: T; message?: string; }
export interface ApiError { success: false; message: string; code?: string; }