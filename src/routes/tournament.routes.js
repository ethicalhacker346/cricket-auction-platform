import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { tournamentController } from '../controllers/tournament.controller.js';
import {
  createTournamentSchema,
  updateTournamentSchema,
  idParamSchema,
} from '../validators/schemas.js';
import { USER_ROLES } from '../config/constants.js';

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

export default router;
