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
import { requireAuctionPermission, loadAuctionAuthorization } from '../middleware/authorization.js';
import { AUCTION_PERMISSIONS } from '../services/permission.engine.js';

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
  validate(auctionIdParamSchema, 'params'),
  requireAuctionPermission(AUCTION_PERMISSIONS.UPDATE_RULES),

  validate(updateAuctionRulesSchema),
  asyncHandler(auctionController.updateRules)
);

auctionRouter.get(
  '/:auctionId/permissions',
  authenticate,
  validate(auctionIdParamSchema, 'params'),
  loadAuctionAuthorization,
  asyncHandler(auctionController.getPermissions)
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
  validate(auctionIdParamSchema, 'params'),
  requireAuctionPermission(AUCTION_PERMISSIONS.MANAGE_ROUNDS),

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
  validate(auctionRoundIdParamSchema, 'params'),
  requireAuctionPermission(AUCTION_PERMISSIONS.MANAGE_ROUNDS),

  validate(updateAuctionRoundSchema),
  asyncHandler(auctionController.updateRound)
);

auctionRouter.delete(
  '/:auctionId/rounds/:roundId',
  authenticate,
  validate(auctionRoundIdParamSchema, 'params'),
  requireAuctionPermission(AUCTION_PERMISSIONS.MANAGE_ROUNDS),

  asyncHandler(auctionController.deleteRound)
);

auctionRouter.post(
  '/:auctionId/start',
  authenticate,
  validate(auctionIdParamSchema, 'params'),
  requireAuctionPermission(AUCTION_PERMISSIONS.START_AUCTION),

  asyncHandler(auctionController.start)
);

auctionRouter.post(
  '/:auctionId/pause',
  authenticate,
  validate(auctionIdParamSchema, 'params'),
  requireAuctionPermission(AUCTION_PERMISSIONS.PAUSE_AUCTION),

  asyncHandler(auctionController.pause)
);

auctionRouter.post(
  '/:auctionId/resume',
  authenticate,
  validate(auctionIdParamSchema, 'params'),
  requireAuctionPermission(AUCTION_PERMISSIONS.RESUME_AUCTION),

  asyncHandler(auctionController.resume)
);

auctionRouter.post(
  '/:auctionId/complete',
  authenticate,
  validate(auctionIdParamSchema, 'params'),
  requireAuctionPermission(AUCTION_PERMISSIONS.COMPLETE_AUCTION),

  asyncHandler(auctionController.complete)
);

auctionRouter.post(
  '/:auctionId/lot/open',
  authenticate,
  validate(auctionIdParamSchema, 'params'),
  requireAuctionPermission(AUCTION_PERMISSIONS.OPEN_LOT),

  validate(openLotSchema),
  asyncHandler(auctionController.openLot)
);

auctionRouter.post(
  '/:auctionId/lot/sold',
  authenticate,
  validate(auctionIdParamSchema, 'params'),
  requireAuctionPermission(AUCTION_PERMISSIONS.SETTLE_LOT),

  asyncHandler(auctionController.settleLotSold)
);

auctionRouter.post(
  '/:auctionId/lot/unsold',
  authenticate,
  validate(auctionIdParamSchema, 'params'),
  requireAuctionPermission(AUCTION_PERMISSIONS.SETTLE_LOT),

  asyncHandler(auctionController.settleLotUnsold)
);

auctionRouter.post(
  '/:auctionId/bids',
  authenticate,
  bidRateLimiter,
  validate(auctionIdParamSchema, 'params'),
  requireAuctionPermission(AUCTION_PERMISSIONS.PLACE_BID),
  validate(placeBidSchema),
  asyncHandler(auctionController.placeBid)
);

export { tournamentAuctionRouter, auctionRouter };