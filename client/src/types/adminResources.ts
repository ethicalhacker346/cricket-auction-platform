import type { MetricMap, RecentActivity } from '@/types/adminDashboard';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages?: number;
  totalPages?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination?: PaginationMeta;
  meta?: PaginationMeta;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface AdminTournament {
  id: string;
  name: string;
  slug: string;
  season?: string | null;
  status: string;
  organizer?: { id: string; name: string; email?: string } | null;
  playerRegistrationOpen?: boolean;
  teamRegistrationOpen?: boolean;
  registrationDeadline?: string | null;
  auctionDate?: string | null;
  playersCount?: number;
  teamsCount?: number;
  maxTeams?: number;
  squadSize?: number;
  createdAt?: string;
}

export interface AdminPlayer {
  id: string;
  fullName: string;
  primaryRole: string;
  nationality?: string | null;
  profileImage?: string | null;
  isActive: boolean;
  user?: { id: string; name: string; email: string; role: string; isActive: boolean } | null;
}

export interface AdminFranchise {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  logo?: string | null;
  isActive: boolean;
  owner?: { id: string; name: string; email?: string; role?: string } | null;
}

export interface AdminAuction {
  id: string;
  name: string;
  status: string;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  tournament?: { id: string; name: string; slug?: string; status?: string } | null;
  bidCount: number;
  activeViewerCount: number;
  unresolvedPlayerCount: number;
  liveState?: { lotStatus?: string; currentHighestBid?: number; currentTournamentPlayerId?: string | null };
}

export interface AdminAuditLog extends RecentActivity {}

export type AdminResourceKind = 'users' | 'tournaments' | 'players' | 'franchises' | 'auctions' | 'audit-logs';
export type AdminResource = AdminUser | AdminTournament | AdminPlayer | AdminFranchise | AdminAuction | AdminAuditLog;

export interface ResourceQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
  isActive?: string;
  sortBy?: string;
  sortOrder?: string;
  tournamentId?: string;
  action?: string;
}

export interface ResourceResponseMap {
  users: AdminUser;
  tournaments: AdminTournament;
  players: AdminPlayer;
  franchises: AdminFranchise;
  auctions: AdminAuction;
  'audit-logs': AdminAuditLog;
}

export type ResourceMetricMap = MetricMap;
