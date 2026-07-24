import { AppError } from '../../src/utils/helpers.js';
import { CAPABILITIES } from './identity.resolver.js';

export const AUCTION_PERMISSIONS = CAPABILITIES;
export const POLICY_VERSION = 2; // bumped: PLACE_BID semantics changed

const STATES = Object.freeze({ DRAFT: 'DRAFT', SCHEDULED: 'SCHEDULED', LIVE: 'LIVE', PAUSED: 'PAUSED', COMPLETED: 'COMPLETED' });

const STATE_RULES = Object.freeze({
  [CAPABILITIES.MANAGE_AUCTION]: [STATES.DRAFT, STATES.SCHEDULED, STATES.LIVE, STATES.PAUSED],
  [CAPABILITIES.UPDATE_RULES]: [STATES.DRAFT, STATES.SCHEDULED],
  [CAPABILITIES.MANAGE_ROUNDS]: [STATES.DRAFT, STATES.SCHEDULED, STATES.LIVE, STATES.PAUSED],
  [CAPABILITIES.START_ROUND]: [STATES.DRAFT, STATES.SCHEDULED],
  [CAPABILITIES.STOP_ROUND]: [STATES.LIVE],
  [CAPABILITIES.UPDATE_ROUND]: [STATES.DRAFT, STATES.SCHEDULED, STATES.LIVE, STATES.PAUSED],
  [CAPABILITIES.START_AUCTION]: [STATES.DRAFT, STATES.SCHEDULED],
  [CAPABILITIES.PAUSE_AUCTION]: [STATES.LIVE],
  [CAPABILITIES.RESUME_AUCTION]: [STATES.PAUSED],
  [CAPABILITIES.COMPLETE_AUCTION]: [STATES.LIVE, STATES.PAUSED],
  [CAPABILITIES.OPEN_LOT]: [STATES.LIVE],
  [CAPABILITIES.SETTLE_LOT]: [STATES.LIVE],
  [CAPABILITIES.PLACE_BID]: [STATES.LIVE],
});

const stateReason = (status, allowedStates) => {
  if (status === STATES.COMPLETED) return 'AUCTION_COMPLETED';
  return `AUCTION_NOT_${allowedStates.join('_OR_')}`;
};

const OWNER_REQUIRED = Object.freeze([
  CAPABILITIES.MANAGE_AUCTION, CAPABILITIES.UPDATE_RULES,
  CAPABILITIES.MANAGE_ROUNDS, CAPABILITIES.START_AUCTION,
  CAPABILITIES.PAUSE_AUCTION, CAPABILITIES.RESUME_AUCTION,
  CAPABILITIES.COMPLETE_AUCTION, CAPABILITIES.OPEN_LOT,
  CAPABILITIES.SETTLE_LOT,
]);

/** Pure policy evaluator: no database work, no UI aliases. */
export class PermissionEngine {
  static evaluate(context) {
    const decisions = {};
    const capabilities = context.identity?.capabilities || new Set();
    const active = context.identity?.isActive !== false;

    for (const permission of Object.values(CAPABILITIES)) {
      let allowed = true;
      let reason = 'ALLOWED';

      if (!active) {
        allowed = false;
        reason = 'USER_INACTIVE';
      } else if (!capabilities.has(permission)) {
        allowed = false;
        reason = 'ROLE_LACKS_CAPABILITY';
      } else if (OWNER_REQUIRED.includes(permission) && !context.ownership?.ownsAuction && context.identity.role !== 'ADMIN') {
        allowed = false;
        reason = 'NOT_RESOURCE_OWNER';
      } else if (permission === CAPABILITIES.PLACE_BID) {
        // Bidding always requires an actual owned, approved TournamentTeam —
        // there is no admin bypass here, because bidding moves a specific
        // team's wallet, and there is no wallet to bid with as ADMIN.
        if (!context.ownership?.team?.owns) {
          allowed = false;
          reason = 'NOT_TOURNAMENT_TEAM_OWNER';
        } else if (!context.ownership.team.approved) {
          allowed = false;
          reason = 'TOURNAMENT_TEAM_NOT_APPROVED';
        } else {
          const allowedStates = STATE_RULES[permission];
          if (allowedStates && !allowedStates.includes(context.auctionStatus)) {
            allowed = false;
            reason = stateReason(context.auctionStatus, allowedStates);
          }
        }
      } else {
        const allowedStates = STATE_RULES[permission];
        if (allowedStates && !allowedStates.includes(context.auctionStatus)) {
          allowed = false;
          reason = stateReason(context.auctionStatus, allowedStates);
        }
      }

      decisions[permission] = { allowed, reason };
    }

    return decisions;
  }

  static require(context, permission) {
    if (!Object.values(AUCTION_PERMISSIONS).includes(permission)) {
      throw new AppError(`Unknown auction permission: ${permission}`, 500);
    }
    const decision = context.decisions?.[permission];
    if (!decision?.allowed) {
      const error = new AppError('You do not have permission to perform this action', 403);
      error.code = decision?.reason || 'PERMISSION_DENIED';
      throw error;
    }
    return context;
  }
}