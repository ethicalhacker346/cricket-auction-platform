import { REGISTRATION_STATUS } from '../../src/config/constants.js';

const id = (value) => value?.toString();

/**
 * Pure ownership evaluation. Receives fully-loaded resources and computes
 * facts only — it never decides what those facts permit. That's
 * PermissionEngine's job. Keeping this pure also makes it trivially
 * unit-testable without mocking Mongoose.
 */
export class OwnershipResolver {
  static resolveAuction({ auction, tournament, tournamentTeam, identity }) {
    const ownsTournament = id(tournament.organizerId) === id(identity.userId);

    const teamOwned = Boolean(tournamentTeam) && id(tournamentTeam.ownerId) === id(identity.userId);
    const teamApproved = teamOwned && tournamentTeam.status === REGISTRATION_STATUS.APPROVED;

    const scope = ownsTournament
      ? 'TOURNAMENT_OWNER'
      : teamOwned
        ? 'TOURNAMENT_TEAM_OWNER'
        : 'NONE';

    return {
      tournamentOwnerId: tournament.organizerId,
      ownsTournament,
      ownsAuction: ownsTournament,
      team: {
        owns: teamOwned,
        approved: teamApproved,
        // Facts, not permissions: a team can be "owned" but PENDING/REJECTED.
        // PermissionEngine reads .owns and .approved separately so it can
        // give a precise denial reason instead of a flat "no".
        id: teamOwned ? tournamentTeam._id : null,
        status: teamOwned ? tournamentTeam.status : null,
        franchiseId: teamOwned ? tournamentTeam.franchiseId : null,
      },
      ownershipScope: scope,
    };
  }
}