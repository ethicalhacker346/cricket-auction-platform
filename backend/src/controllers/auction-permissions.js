import { AuctionAuthorizationService } from '../services/auction-authorization.service.js';

// UI aliases belong at the API boundary, not inside the policy engine.
const UI_ALIASES = Object.freeze({
  canManageAuction: 'MANAGE_AUCTION',
  canStart: 'START_AUCTION',
  canPause: 'PAUSE_AUCTION',
  canResume: 'RESUME_AUCTION',
  canOpenLot: 'OPEN_LOT',
  canForceSold: 'SETTLE_LOT',
  canBid: 'PLACE_BID',
});

export const auctionPermissionsController = {
  get: async (req, res) => {
    const context = req.authorization || await AuctionAuthorizationService.buildContext({
      auctionId: req.params.auctionId,
      user: req.user,
    });
    const base = AuctionAuthorizationService.toPublicPermissions(context);
    const aliases = Object.fromEntries(
      Object.entries(UI_ALIASES).map(([alias, permission]) => [alias, base.permissions[permission]])
    );
    return res.json({
      success: true,
      data: { ...aliases, ...base },
    });
  },
};
