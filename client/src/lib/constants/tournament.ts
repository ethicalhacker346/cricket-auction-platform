import type { PlayerRole, TeamStatus, TournamentStatus } from "@/types/tournament";

export const TOURNAMENT_STATUS: Record<TournamentStatus, TournamentStatus> = {
  DRAFT: "DRAFT",
  PLAYER_REGISTRATION_OPEN: "PLAYER_REGISTRATION_OPEN",
  TEAM_REGISTRATION_OPEN: "TEAM_REGISTRATION_OPEN",
  TEAMS_APPROVED: "TEAMS_APPROVED",
  TEAMS_REJECTED: "TEAMS_REJECTED",
  AUCTION_SCHEDULED: "AUCTION_SCHEDULED",
  AUCTION_RUNNING: "AUCTION_RUNNING",
  AUCTION_COMPLETED: "AUCTION_COMPLETED",
  TOURNAMENT_COMPLETED: "TOURNAMENT_COMPLETED",
  CANCELLED: "CANCELLED",
};

// Mirrors the backend state machine (TOURNAMENT_TRANSITIONS) so the UI never
// offers an action that the API would reject. Updated to match new backend.
export const TOURNAMENT_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  DRAFT: ["PLAYER_REGISTRATION_OPEN", "CANCELLED"],
  PLAYER_REGISTRATION_OPEN: ["TEAM_REGISTRATION_OPEN", "CANCELLED"],
  TEAM_REGISTRATION_OPEN: ["TEAMS_APPROVED", "CANCELLED"],
  TEAMS_APPROVED: ["AUCTION_SCHEDULED", "CANCELLED"],
  TEAMS_REJECTED: ["CANCELLED"],
  AUCTION_SCHEDULED: ["AUCTION_RUNNING"],
  AUCTION_RUNNING: ["AUCTION_COMPLETED"],
  AUCTION_COMPLETED: ["TOURNAMENT_COMPLETED"],
  TOURNAMENT_COMPLETED: [],
  CANCELLED: [],
};

export const STATUS_META: Record<
  TournamentStatus,
  { label: string; badge: string; dot: string; description: string }
> = {
  DRAFT: {
    label: "Draft",
    badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    dot: "bg-slate-400",
    description: "Only visible to you. Publish by opening registration.",
  },
  PLAYER_REGISTRATION_OPEN: {
    label: "Player Registration Open",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dot: "bg-amber-500",
    description: "Players can register for the tournament.",
  },
  TEAM_REGISTRATION_OPEN: {
    label: "Team Registration Open",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dot: "bg-amber-500",
    description: "Franchises/teams can register.",
  },
  TEAMS_APPROVED: {
    label: "Teams Approved",
    badge: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    dot: "bg-indigo-500",
    description: "Rosters locked. Ready for auction scheduling.",
  },
  TEAMS_REJECTED: {
    label: "Teams Rejected",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    dot: "bg-rose-500",
    description: "Registration did not pass approval.",
  },
  AUCTION_SCHEDULED: {
    label: "Auction Scheduled",
    badge: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
    dot: "bg-purple-500",
    description: "Auction date is set. Awaiting start.",
  },
  AUCTION_RUNNING: {
    label: "Auction Live",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-emerald-500",
    description: "Bidding is currently underway.",
  },
  AUCTION_COMPLETED: {
    label: "Auction Completed",
    badge: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
    dot: "bg-teal-500",
    description: "Squads finalized. Ready for tournament.",
  },
  TOURNAMENT_COMPLETED: {
    label: "Tournament Completed",
    badge: "bg-slate-800 text-white ring-1 ring-slate-800",
    dot: "bg-slate-500",
    description: "This tournament has concluded.",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    dot: "bg-rose-500",
    description: "This tournament was cancelled.",
  },
};

export const LIFECYCLE_STEPS: TournamentStatus[] = [
  "DRAFT",
  "PLAYER_REGISTRATION_OPEN",
  "TEAM_REGISTRATION_OPEN",
  "TEAMS_APPROVED",
  "AUCTION_SCHEDULED",
  "AUCTION_RUNNING",
  "AUCTION_COMPLETED",
  "TOURNAMENT_COMPLETED",
];

export const ONGOING_STATUSES: TournamentStatus[] = [
  "DRAFT",
  "PLAYER_REGISTRATION_OPEN",
  "TEAM_REGISTRATION_OPEN",
  "TEAMS_APPROVED",
  "AUCTION_SCHEDULED",
  "AUCTION_RUNNING",
  "AUCTION_COMPLETED",
];

export const PAST_STATUSES: TournamentStatus[] = ["TOURNAMENT_COMPLETED", "CANCELLED"];

export const isOngoingStatus = (status: TournamentStatus) => ONGOING_STATUSES.includes(status);
export const isPastStatus = (status: TournamentStatus) => PAST_STATUSES.includes(status);

export const TEAM_STATUS_META: Record<TeamStatus, { label: string; badge: string }> = {
  PENDING: { label: "Pending Approval", badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  APPROVED: { label: "Approved", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  REJECTED: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" },
};

export const PLAYER_ROLE_META: Record<PlayerRole, { label: string; short: string }> = {
  BATSMAN: { label: "Batsman", short: "BAT" },
  BOWLER: { label: "Bowler", short: "BWL" },
  ALL_ROUNDER: { label: "All-Rounder", short: "AR" },
  WICKET_KEEPER: { label: "Wicket-Keeper", short: "WK" },
};

export const CURRENCIES = ["INR", "USD", "GBP", "AUD"] as const;
