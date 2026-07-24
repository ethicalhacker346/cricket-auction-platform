import { Auction } from '../../src/models/Auction.js';
import { Tournament } from '../../src/models/Tournament.js';
import { TournamentTeam } from '../../src/models/TournamentTeam.js';
import { AppError, assertFound } from '../../src/utils/helpers.js';
import { IdentityResolver } from './identity.resolver.js';
import { OwnershipResolver } from './ownership.resolver.js';
import { PermissionEngine, POLICY_VERSION } from './permission.engine.js';

export class AuctionAuthorizationService {
  static async buildContext({ auctionId, user }) {
    const identity = IdentityResolver.resolve(user);

    const auction = assertFound(
      await Auction.findById(auctionId).populate('tournamentId'),
      'Auction not found'
    );
    const tournament = auction.tournamentId;
    if (!tournament?._id) throw new AppError('Tournament not found', 404);

    // Deliberately not gated by role. A future role (co-owner, delegated
    // manager, auction staff who also owns a franchise) is covered for
    // free instead of requiring someone to remember to extend a role
    // allowlist here. Cost is one indexed lookup per context build.
    const tournamentTeam = await TournamentTeam.findOne({
      tournamentId: tournament._id,
      ownerId: identity.userId,
    }).lean();

    const ownership = OwnershipResolver.resolveAuction({ auction, tournament, tournamentTeam, identity });

    const context = {
      policyVersion: POLICY_VERSION,
      identity,
      ownership,
      userId: identity.userId,
      role: identity.role,
      tournamentId: tournament._id,
      auctionId: auction._id,
      tournamentOwnerId: ownership.tournamentOwnerId,
      ownsTournament: ownership.ownsTournament,
      ownsAuction: ownership.ownsAuction,
      auctionStatus: auction.status,
      auction,
      tournament,
    };
    context.decisions = PermissionEngine.evaluate(context);
    context.require = (permission) => PermissionEngine.require(context, permission);
    return context;
  }

  static async assertPermission({ auctionId, user, permission, existingContext }) {
    const context = existingContext || await AuctionAuthorizationService.buildContext({ auctionId, user });
    return PermissionEngine.require(context, permission);
  }

  static toPublicPermissions(context) {
    return {
      policyVersion: context.policyVersion,
      permissions: Object.fromEntries(
        Object.entries(context.decisions).map(([key, value]) => [key, value.allowed])
      ),
      reasons: Object.fromEntries(
        Object.entries(context.decisions).map(([key, value]) => [key, value.reason])
      ),
      ownsAuction: context.ownsAuction,
      ownsTournament: context.ownsTournament,
      ownsTournamentTeam: context.ownership.team.owns,
      tournamentTeamApproved: context.ownership.team.approved,
      tournamentTeamId: context.ownership.team.id,
      role: context.role,
      auctionStatus: context.auctionStatus,
    };
  }
}