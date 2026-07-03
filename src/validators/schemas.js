import { z } from 'zod';
import { USER_ROLES, PLAYER_ROLES } from '../config/constants.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  role: z.enum(Object.values(USER_ROLES)).optional(),
  phone: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createTournamentSchema = z.object({
  name: z.string().trim().min(3).max(160),
  description: z.string().max(2000).optional(),
  season: z.string().trim().optional(),
  venue: z.string().trim().optional(),
  maxTeams: z.number().int().min(2).max(32).optional(),
  squadSize: z.number().int().min(5).max(25).optional(),
  defaultPurse: z.number().min(0).optional(),
  minBidIncrement: z.number().min(1).optional(),
  lotTimerSeconds: z.number().int().min(5).max(300).optional(),
  registrationDeadline: z.coerce.date().optional(),
  auctionDate: z.coerce.date().optional(),
});

export const updateTournamentSchema = createTournamentSchema.partial();

export const createPlayerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  dateOfBirth: z.coerce.date().optional(),
  nationality: z.string().trim().optional(),
  primaryRole: z.enum(Object.values(PLAYER_ROLES)),
  battingStyle: z.string().trim().optional(),
  bowlingStyle: z.string().trim().optional(),
  bio: z.string().max(1000).optional(),
});

export const createFranchiseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().optional(),
  description: z.string().max(1000).optional(),
  logo: z.string().url().optional(),
});

export const registerTournamentPlayerSchema = z.object({
  basePrice: z.number().min(0).optional(),
  category: z.string().trim().optional(),
  primaryRole: z.enum(Object.values(PLAYER_ROLES)).optional(),
});

export const registerTournamentTeamSchema = z.object({
  franchiseId: objectId,
});

export const createAuctionSchema = z.object({
  bidIncrement: z.number().min(1).optional(),
  lotTimerSeconds: z.number().int().min(5).max(300).optional(),
  scheduledAt: z.coerce.date().optional(),
});

export const createAuctionRoundSchema = z.object({
  name: z.string().trim().min(2).max(120),
  order: z.number().int().min(1),
  type: z.string().trim().optional(),
  playerIds: z.array(objectId).optional(),
});

export const placeBidSchema = z.object({
  amount: z.number().min(1),
});

export const openLotSchema = z.object({
  tournamentPlayerId: objectId,
  roundId: objectId,
});

export const rejectRegistrationSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const idParamSchema = z.object({
  id: objectId,
});

export const tournamentIdParamSchema = z.object({
  tournamentId: objectId,
});

export const auctionIdParamSchema = z.object({
  auctionId: objectId,
});
