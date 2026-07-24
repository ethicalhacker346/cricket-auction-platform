import { AuctionAuthorizationService } from './auction-authorization.service.js';

/** Thin façade for callers; domain services own their loading strategies. */
export class AuthorizationService {
  static buildAuctionContext(args) {
    return AuctionAuthorizationService.buildContext(args);
  }

  static assertAuctionPermission(args) {
    return AuctionAuthorizationService.assertPermission(args);
  }

  static getAuctionPermissions({ auctionId, user }) {
    return AuctionAuthorizationService.buildContext({ auctionId, user })
      .then(AuctionAuthorizationService.toPublicPermissions);
  }
}
