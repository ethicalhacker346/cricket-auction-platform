export type TournamentStatus =
  | "DRAFT"
  | "TEAMS_APPROVED"
  | "AUCTION_SCHEDULED"
  | "AUCTION_RUNNING"
  | "AUCTION_COMPLETED"
  | "TOURNAMENT_COMPLETED"
  | "PLAYER_REGISTRATION_OPEN"
  | "TEAM_REGISTRATION_OPEN"
  | "TEAMS_REJECTED"
  | "CANCELLED";

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  description?: string;
  organizerId: string;
  organizerName: string;
  status: TournamentStatus;
  season?: string;
  venue?: string;
  playerRegistrationOpen: boolean;
  teamRegistrationOpen: boolean;
  registrationDeadline?: string;
  auctionDate?: string;
  maxTeams: number;
  squadSize: number;
  defaultPurse: number;
  minBidIncrement: number;
  lotTimerSeconds: number;
  currency: string;
  teamsCount: number;
  playersCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentPayload {
  name: string;
  slug: string;
  description?: string;
  season?: string;
  venue?: string;
  registrationDeadline?: string;
  auctionDate?: string;
  maxTeams: number;
  squadSize: number;
  defaultPurse: number;
  minBidIncrement: number;
  lotTimerSeconds: number;
  currency: string;
}

export type TeamStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  ownerId: string;
  ownerName: string;
  name: string;
  shortCode: string;
  city?: string;
  contactEmail: string;
  contactPhone?: string;
  brandColor: string;
  purse: number;
  status: TeamStatus;
  createdAt: string;
}

export interface TeamRegistrationPayload {
  name: string;
  shortCode: string;
  city?: string;
  contactEmail: string;
  contactPhone?: string;
  brandColor: string;
}

export type PlayerRole = "BATSMAN" | "BOWLER" | "ALL_ROUNDER" | "WICKET_KEEPER";

export type PlayerRegistrationStatus = "REGISTERED" | "SOLD" | "UNSOLD";

export interface TournamentPlayer {
  id: string;
  tournamentId: string;
  userId: string;
  name: string;
  role: PlayerRole;
  battingStyle?: string;
  bowlingStyle?: string;
  basePrice: number;
  contactPhone?: string;
  experienceYears?: number;
  status: PlayerRegistrationStatus;
  createdAt: string;
}

export interface PlayerRegistrationPayload {
  name: string;
  role: PlayerRole;
  battingStyle?: string;
  bowlingStyle?: string;
  basePrice: number;
  contactPhone?: string;
  experienceYears?: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}
