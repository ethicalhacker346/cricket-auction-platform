import { asyncHandler } from '../../src/utils/asyncHandler.js';
import { AuthorizationService } from '../services/authorization.service.js';
import { PermissionEngine } from '../services/permission.engine.js';

const sameContext = (context, req) =>
  context && context.auctionId?.toString() === req.params.auctionId?.toString() &&
  context.userId?.toString() === req.user?._id?.toString();

export const requireAuctionPermission = (permission) =>
  asyncHandler(async (req, _res, next) => {
    const context = sameContext(req.authorization, req)
      ? req.authorization
      : await AuthorizationService.buildAuctionContext({ auctionId: req.params.auctionId, user: req.user });
    PermissionEngine.require(context, permission);
    req.authorization = context;
    return next();
  });

export const loadAuctionAuthorization = asyncHandler(async (req, _res, next) => {
  if (!sameContext(req.authorization, req)) {
    req.authorization = await AuthorizationService.buildAuctionContext({
      auctionId: req.params.auctionId,
      user: req.user,
    });
  }
  return next();
});