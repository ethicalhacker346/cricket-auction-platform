import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize, optionalAuthenticate} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { tournamentController } from '../controllers/tournament.controller.js';
import { registrationController } from '../controllers/registration.controller.js';
import {
  createTournamentSchema,
  updateTournamentSchema,
  idParamSchema,
} from '../validators/schemas.js';
import { USER_ROLES } from '../config/constants.js';
import { singleUpload, validateImageBuffer } from '../middleware/upload.middleware.js';
import { imageUploadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/', asyncHandler(tournamentController.list));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(tournamentController.getById));

router.post(
  '/',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(createTournamentSchema),
  asyncHandler(tournamentController.create)
);

router.patch(
  '/:id',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(idParamSchema, 'params'),
  validate(updateTournamentSchema),
  asyncHandler(tournamentController.update)
);

// library
router.patch('/:id/logo',   authenticate, imageUploadLimiter, singleUpload('image'), validateImageBuffer, tournamentController.uploadLogo);
router.delete('/:id/logo',  authenticate, tournamentController.removeLogo);

router.post(
  '/:id/open-player-registration',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(idParamSchema, 'params'),
  asyncHandler(tournamentController.openPlayerRegistration)
);

router.post(
  '/:id/open-team-registration',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(idParamSchema, 'params'),
  asyncHandler(tournamentController.openTeamRegistration)
);

router.post(
  '/:id/approve-teams',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(idParamSchema, 'params'),
  asyncHandler(tournamentController.markTeamsApproved)
);
router.post('/:id/schedule-auction', authenticate, authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN), asyncHandler(tournamentController.scheduleAuction));
router.post('/:id/start-auction', authenticate, authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN), asyncHandler(tournamentController.startAuction));
router.post('/:id/complete-auction', authenticate, authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN), asyncHandler(tournamentController.completeAuction));
router.post('/:id/complete-tournament', authenticate, authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN), asyncHandler(tournamentController.completeTournament));
router.post('/:id/cancel', authenticate, authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN), asyncHandler(tournamentController.cancel));

// ============================================================================
// PLAYER POOL — Direct tournament-level access for auction round assignment UI
// ============================================================================
// This route serves the player pool that organizers browse when assigning
// players to auction rounds. It delegates to the registration controller
// because TournamentPlayer is the source of truth for "who is in this
// tournament", but the path is tournament-scoped (not nested under
// /registrations) because the auction UI treats players as a tournament
// resource, not a registration workflow resource.
//
// optionalAuthenticate: spectators can browse the player pool; only the
// assignment actions (PATCH round) require organizer permissions.
// ============================================================================
router.get(
  '/:id/players',
  optionalAuthenticate,
  validate(idParamSchema, 'params'),
  asyncHandler(registrationController.listPlayers)
);

// ============================================================================
// APPROVED PLAYER POOL — Auction-ready players only
// ============================================================================
// Spectators and organizers alike need this list. The auction UI, squad-
// builder, and public "confirmed participants" page all consume it.
// ============================================================================
router.get(
  '/:id/players/approved',
  optionalAuthenticate,
  validate(idParamSchema, 'params'),
  asyncHandler(registrationController.listApprovedPlayers)
);

export default router;
