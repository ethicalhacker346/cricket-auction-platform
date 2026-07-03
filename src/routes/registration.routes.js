import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registrationController } from '../controllers/registration.controller.js';
import {
  registerTournamentPlayerSchema,
  registerTournamentTeamSchema,
  rejectRegistrationSchema,
  registrationIdParamSchema,
  teamIdParamSchema,
} from '../validators/schemas.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router({ mergeParams: true });

router.post(
  '/players',
  authenticate,
  authorize(USER_ROLES.PLAYER, USER_ROLES.ADMIN),
  validate(registerTournamentPlayerSchema),
  asyncHandler(registrationController.registerPlayer)
);

router.get('/players', asyncHandler(registrationController.listPlayers));

router.patch(
  '/players/:registrationId/verify',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(registrationIdParamSchema, 'params'),
  asyncHandler(registrationController.verifyPlayer)
);

router.patch(
  '/players/:registrationId/reject',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(registrationIdParamSchema, 'params'),
  validate(rejectRegistrationSchema),
  asyncHandler(registrationController.rejectPlayer)
);

router.post(
  '/teams',
  authenticate,
  authorize(USER_ROLES.FRANCHISE_OWNER, USER_ROLES.ADMIN),
  validate(registerTournamentTeamSchema),
  asyncHandler(registrationController.registerTeam)
);

router.get('/teams', asyncHandler(registrationController.listTeams));

router.patch(
  '/teams/:teamId/approve',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(teamIdParamSchema, 'params'),
  asyncHandler(registrationController.approveTeam)
);

router.patch(
  '/teams/:teamId/reject',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(teamIdParamSchema, 'params'),
  validate(rejectRegistrationSchema),
  asyncHandler(registrationController.rejectTeam)
);

router.get('/squads/export', asyncHandler(registrationController.exportSquads));

export default router;
