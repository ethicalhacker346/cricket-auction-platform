// src/types/registration.ts
import type { PlayerRole, TournamentStatus } from "@/types/tournament";

export type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type LotOutcome = "NOT_LISTED" | (string & {});

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PlayerListQueryParams extends PaginationParams {
  userId?: string;
  search?: string;
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
  cricHeroesUrl?: string | null;
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

/** Public flat list projection; create/update endpoints return PlayerRegistration. */
export interface PlayerRegistrationListItem {
  id: string;
  registrationId: string;
  rejectedReason?: string;
  playerId?: string;
  name: string;
  role: PlayerRole;
  basePrice: number;
  basePriceUpdatedAt?: string | null;
  status: RegistrationStatus;
  lotOutcome: LotOutcome;
  isSold: boolean;
  soldPrice?: number;
  profileImage?: string | null;
  cricHeroesUrl?: string | null;
  createdAt: string;
  userId?: string;
  isMine?: boolean;
}

// Role and base price remain server-derived; the optional profile link is
// saved to the canonical Player in the same transaction as registration.
export interface RegisterPlayerPayload {
  cricHeroesUrl?: string;
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