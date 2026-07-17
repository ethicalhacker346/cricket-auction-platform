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

// ════════════════════════════════════════════════════════════════════════
// NEW: PASSWORD RESET SCHEMAS
// ════════════════════════════════════════════════════════════════════════

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const verifyTokenSchema = z.object({
  token: z.string().length(128, 'Invalid token format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().length(128, 'Invalid or missing reset token'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
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
  logo: z.string().url().optional(),
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
  profileImage: z.string().url().optional(),
});

export const setBasePriceSchema = z.object({
  basePrice: z.coerce.number().min(0, 'Base price must be 0 or greater'),
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
  name: z.string().trim().min(1).max(160).optional(),

  bidIncrementTiers: z.array(
    z.object({
      upTo: z.number().min(0).nullable(),
      increment: z.number().min(1),
    })
  ).min(1).optional(),

  lotTimerSeconds: z.number().int().min(5).max(300).optional(),

  bidResetSeconds: z.number().int().min(3).max(120).optional(),

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

export const auctionRoundIdParamSchema = z.object({
  auctionId: objectId,
  roundId: objectId,
});
 
export const updateAuctionRulesSchema = z.object({

  name: z.string().trim().min(1).max(160).optional(),

  bidIncrementTiers: z.array(
    z.object({
      upTo: z.number().min(0).nullable(),
      increment: z.number().min(1),
    })
  ).optional(),

  lotTimerSeconds: z.number().min(5).max(600).optional(),

  bidResetSeconds: z.number().min(3).max(120).optional(),

  scheduledAt: z.coerce.date().optional(),

}).refine(
    data => Object.values(data).some(v => v !== undefined),
    {
        message:"At least one field must be provided"
    }
);

export const updateAuctionRoundSchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    type: z.string().trim().max(40).optional(),
    order: z.number().min(1).optional(),
    playerIds: z.array(objectId).optional(),
  })
  .refine(
    (data) => {
      return Object.values(data).some((value) => value !== undefined);
    },
    {
      message: "At least one field must be provided",
    }
  );

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

export const registrationIdParamSchema = z.object({
  registrationId: objectId,
});

export const teamIdParamSchema = z.object({
  teamId: objectId,
});
export const auctionIdParamSchema = z.object({
  auctionId: objectId,
});


export const heartbeatViewerSchema = z.object({
  auctionId: objectId,
  roundId: objectId,
  tournamentPlayerId: objectId,
  viewerId: z.string().trim().min(1),
});

export const leaveViewerSchema = z.object({
  auctionId: objectId,
  roundId: objectId,
  tournamentPlayerId: objectId,
  viewerId: z.string().trim().min(1),
});