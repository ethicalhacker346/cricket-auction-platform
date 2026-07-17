// src/types/registration.ts
import type { PlayerRole, TournamentStatus } from "@/types/tournament";

export type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type LotOutcome = "NOT_LISTED" | (string & {});

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PlayerListQueryParams extends PaginationParams {
  status?: RegistrationStatus;
  isSold?: boolean;
  lotOutcome?: LotOutcome;
}

export interface TeamListQueryParams extends PaginationParams {
  status?: RegistrationStatus;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  
}

export interface PopulatedPlayer {
  _id: string;
  fullName: string;
  primaryRole?: PlayerRole;
  [key: string]: unknown;
}

export interface PopulatedFranchise {
  _id: string;
  name: string;
  [key: string]: unknown;
}

export interface PlayerRegistration {
  _id: string;
  tournamentId: string;
  playerId: string | PopulatedPlayer;
  userId: string;
  basePrice: number;           // Set by organizer, NOT by player
  primaryRole: PlayerRole;
  status: RegistrationStatus;
  lotOutcome: LotOutcome;
  isSold?: boolean;
  verifiedAt?: string;
  rejectedReason?: string;
  createdAt: string;
  updatedAt: string;
}

// Player registration payload: basePrice is omitted — organizer sets it.
// primaryRole is auto-pulled from the Player profile by the backend.
// The only thing a player CAN supply is... nothing. But we keep the type
// extensible for future fields (e.g. preferred auction slot, special requests).
export interface RegisterPlayerPayload {
  // Intentionally empty for now. Backend derives everything from Player profile.
  // If you add optional fields later, add them here without breaking existing calls.
}

export interface TeamWallet {
  initialBudget: number;
  spentBudget: number;
  remainingBudget: number;
  reservedBudget: number;
}

export interface RosterEntry {
  tournamentPlayerId: string;
  role?: string;
  boughtPrice?: number;
  boughtAt?: string;
}

export interface TeamRegistration {
  _id: string;
  tournamentId: string;
  franchiseId: string | PopulatedFranchise;
  ownerId: string;
  name: string;
  status: RegistrationStatus;
  wallet: TeamWallet;
  roster: RosterEntry[];
  approvedAt?: string;
  rejectedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterTeamPayload {
  franchiseId: string;
}

export interface RejectPayload {
  reason: string;
}

export interface SquadExportResponse {
  tournament: {
    id: string;
    name: string;
    status: TournamentStatus;
  };
  teams: {
    id: string;
    name: string;
    franchise: PopulatedFranchise;
    wallet: TeamWallet;
    squad: {
      tournamentPlayerId?: string;
      player?: PopulatedPlayer;
      role?: string;
      boughtPrice?: number;
      boughtAt?: string;
    }[];
  }[];
}