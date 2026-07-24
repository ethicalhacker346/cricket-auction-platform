import { AppError } from '../../src/utils/helpers.js';

export const CAPABILITIES = Object.freeze({
  MANAGE_AUCTION: 'MANAGE_AUCTION',
  UPDATE_RULES: 'UPDATE_RULES',
  MANAGE_ROUNDS: 'MANAGE_ROUNDS',
  START_AUCTION: 'START_AUCTION',
  PAUSE_AUCTION: 'PAUSE_AUCTION',
  RESUME_AUCTION: 'RESUME_AUCTION',
  COMPLETE_AUCTION: 'COMPLETE_AUCTION',
  OPEN_LOT: 'OPEN_LOT',
  SETTLE_LOT: 'SETTLE_LOT',
  PLACE_BID: 'PLACE_BID',
});

const ROLE_CAPABILITIES = Object.freeze({
  ORGANIZER: [
    CAPABILITIES.MANAGE_AUCTION,
    CAPABILITIES.UPDATE_RULES,
    CAPABILITIES.MANAGE_ROUNDS,
    CAPABILITIES.START_AUCTION,
    CAPABILITIES.PAUSE_AUCTION,
    CAPABILITIES.RESUME_AUCTION,
    CAPABILITIES.COMPLETE_AUCTION,
    CAPABILITIES.OPEN_LOT,
    CAPABILITIES.SETTLE_LOT,
  ],
  FRANCHISE_OWNER: [CAPABILITIES.PLACE_BID],
  PLAYER: [],
  ADMIN: Object.values(CAPABILITIES),
});

export class IdentityResolver {
  static resolve(user) {
    if (!user?._id) throw new AppError('Authentication required', 401);

    const capabilities = new Set(ROLE_CAPABILITIES[user.role] || []);
    return {
      userId: user._id,
      role: user.role,
      email: user.email,
      isActive: user.isActive !== false,
      capabilities, 
    };
  }
}
