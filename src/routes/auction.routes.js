import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bidRateLimiter } from '../middleware/rateLimiter.js';
import { auctionController } from '../controllers/auction.controller.js';
import {
  createAuctionSchema,
  createAuctionRoundSchema,
  placeBidSchema,
  openLotSchema,
  auctionIdParamSchema,
  tournamentIdParamSchema,
} from '../validators/schemas.js';
import { USER_ROLES } from '../config/constants.js';

const tournamentAuctionRouter = Router({ mergeParams: true });

tournamentAuctionRouter.post(
  '/',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(createAuctionSchema),
  asyncHandler(auctionController.create)
);

tournamentAuctionRouter.get('/', asyncHandler(auctionController.getByTournament));

const auctionRouter = Router();

auctionRouter.get('/:auctionId', validate(auctionIdParamSchema, 'params'), asyncHandler(auctionController.getById));
auctionRouter.get('/:auctionId/live', validate(auctionIdParamSchema, 'params'), asyncHandler(auctionController.getLiveState));
auctionRouter.get('/:auctionId/bids', validate(auctionIdParamSchema, 'params'), asyncHandler(auctionController.listBids));

auctionRouter.post(
  '/:auctionId/rounds',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(auctionIdParamSchema, 'params'),
  validate(createAuctionRoundSchema),
  asyncHandler(auctionController.addRound)
);

auctionRouter.post(
  '/:auctionId/start',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(auctionIdParamSchema, 'params'),
  asyncHandler(auctionController.start)
);

auctionRouter.post(
  '/:auctionId/pause',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(auctionIdParamSchema, 'params'),
  asyncHandler(auctionController.pause)
);

auctionRouter.post(
  '/:auctionId/resume',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(auctionIdParamSchema, 'params'),
  asyncHandler(auctionController.resume)
);

auctionRouter.post(
  '/:auctionId/complete',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(auctionIdParamSchema, 'params'),
  asyncHandler(auctionController.complete)
);

auctionRouter.post(
  '/:auctionId/lot/open',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(auctionIdParamSchema, 'params'),
  validate(openLotSchema),
  asyncHandler(auctionController.openLot)
);

auctionRouter.post(
  '/:auctionId/lot/sold',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(auctionIdParamSchema, 'params'),
  asyncHandler(auctionController.settleLotSold)
);

auctionRouter.post(
  '/:auctionId/lot/unsold',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(auctionIdParamSchema, 'params'),
  asyncHandler(auctionController.settleLotUnsold)
);

auctionRouter.post(
  '/:auctionId/bids',
  authenticate,
  authorize(USER_ROLES.FRANCHISE_OWNER, USER_ROLES.ADMIN),
  bidRateLimiter,
  validate(auctionIdParamSchema, 'params'),
  validate(placeBidSchema),
  asyncHandler(auctionController.placeBid)
);

export { tournamentAuctionRouter, auctionRouter };
