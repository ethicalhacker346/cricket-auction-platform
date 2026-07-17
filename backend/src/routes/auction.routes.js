import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bidRateLimiter } from '../middleware/rateLimiter.js';
import { auctionController } from '../controllers/auction.controller.js';
import {
  createAuctionSchema, // UPDATE — body shape changed: bidIncrement (number) is gone,
  // replaced by bidIncrementTiers (array); name is now a valid top-level
  // field. See Auction.js / auction.service.js for the current shape.
  createAuctionRoundSchema,
  updateAuctionRulesSchema, // UPDATE — same bidIncrement -> bidIncrementTiers change as
  // createAuctionSchema above; also now accepts `name`.
  updateAuctionRoundSchema, // NEW — add to validators/schemas.js, see note below
  placeBidSchema,
  openLotSchema,
  auctionIdParamSchema,
  auctionRoundIdParamSchema, // NEW — add to validators/schemas.js, see note below
  tournamentIdParamSchema,
  heartbeatViewerSchema, // NEW — add to validators/schemas.js: { viewerId: string().required() }
  leaveViewerSchema, // NEW — add to validators/schemas.js: same shape as heartbeatViewerSchema
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

auctionRouter.patch(
  '/:auctionId',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(auctionIdParamSchema, 'params'),
  validate(updateAuctionRulesSchema),
  asyncHandler(auctionController.updateRules)
);

auctionRouter.get('/:auctionId/live', validate(auctionIdParamSchema, 'params'), asyncHandler(auctionController.getLiveState));

// Poll-friendly superset of /live: bundles auction + rounds + players +
// franchises + bidHistory + logs into one response. Intended as the interim
// data source for the frontend's LiveAuctionSnapshot store until a real
// push transport (Socket.IO/SSE) exists — see CHANGES.md "Real-time" section.
auctionRouter.get('/:auctionId/snapshot', validate(auctionIdParamSchema, 'params'), asyncHandler(auctionController.getSnapshot));

// Live viewer presence — see models/AuctionViewer.js and
// AuctionService.heartbeatViewer for the full reasoning. Deliberately NOT
// behind `authenticate`: an anonymous spectator on a public auction link is
// exactly who this is meant to count, same access level as getLiveState/
// getSnapshot above. If a request happens to carry a valid session, that's
// only used inside the controller as an optional req.user — nothing here
// requires it or rejects its absence.
//
// TODO: consider a dedicated, more permissive rate limiter than
// bidRateLimiter (heartbeats are frequent-but-harmless reads, not bids) if
// this endpoint sees abuse — not wired up here since the shape of the
// existing limiter middleware isn't visible from this file.
auctionRouter.post(
  '/:auctionId/viewers/heartbeat',
  validate(auctionIdParamSchema, 'params'),
  validate(heartbeatViewerSchema),
  asyncHandler(auctionController.heartbeatViewer)
);

// Fired from the client's beforeunload/sendBeacon handler on tab close —
// same public access as heartbeat above, since leaving is just the inverse
// of joining and shouldn't require a login the join itself didn't need.
auctionRouter.post(
  '/:auctionId/viewers/leave',
  validate(auctionIdParamSchema, 'params'),
  validate(leaveViewerSchema),
  asyncHandler(auctionController.leaveViewer)
);

auctionRouter.get(
  '/:auctionId/viewers/count',
  validate(auctionIdParamSchema, 'params'),
  asyncHandler(auctionController.getViewerCount)
);

auctionRouter.get('/:auctionId/bids', validate(auctionIdParamSchema, 'params'), asyncHandler(auctionController.listBids));

auctionRouter.post(
  '/:auctionId/rounds',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(auctionIdParamSchema, 'params'),
  validate(createAuctionRoundSchema),
  asyncHandler(auctionController.addRound)
);

// Public read — players and franchise owners need round order/composition
// to see what's coming up, same access level as getLiveState/getById.
auctionRouter.get(
  '/:auctionId/rounds',
  validate(auctionIdParamSchema, 'params'),
  asyncHandler(auctionController.listRounds)
);

auctionRouter.patch(
  '/:auctionId/rounds/:roundId',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(auctionRoundIdParamSchema, 'params'),
  validate(updateAuctionRoundSchema),
  asyncHandler(auctionController.updateRound)
);

auctionRouter.delete(
  '/:auctionId/rounds/:roundId',
  authenticate,
  authorize(USER_ROLES.ORGANIZER, USER_ROLES.ADMIN),
  validate(auctionRoundIdParamSchema, 'params'),
  asyncHandler(auctionController.deleteRound)
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