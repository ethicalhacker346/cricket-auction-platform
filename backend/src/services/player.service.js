import { Player } from '../models/Player.js';
import { AppError, assertFound, parsePagination, buildPaginatedResponse } from '../utils/helpers.js';

// Defense in depth: even though the route's validator schema should already
// restrict what a PATCH /me body can contain, the service shouldn't trust
// that as the only line of defense — Object.assign(player, rawPayload)
// would happily let a stray `userId` or `isActive` field through if the
// validator schema is ever loosened upstream.
const UPDATABLE_FIELDS = [
  'fullName',
  'dateOfBirth',
  'nationality',
  'primaryRole',
  'battingStyle',
  'bowlingStyle',
  'profileImage',
  'bio',
];

export class PlayerService {
  static async createProfile(userId, payload) {
    const existing = await Player.findOne({ userId });
    if (existing) {
      throw new AppError('Player profile already exists for this user', 409);
    }

    return Player.create({
      userId,
      ...payload,
    });
  }

  static async getMyProfile(userId) {
    return assertFound(await Player.findOne({ userId }), 'Player profile not found');
  }

  static async getById(id) {
    return assertFound(
      await Player.findById(id).populate('userId', 'name email role'),
      'Player not found'
    );
  }

  static async list(query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { isActive: true };

    if (query.primaryRole) filter.primaryRole = query.primaryRole;

    const [data, total] = await Promise.all([
      Player.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Player.countDocuments(filter),
    ]);

    return buildPaginatedResponse({ data, total, page, limit });
  }

  static async updateProfile(userId, payload) {
    const player = await PlayerService.getMyProfile(userId);

    for (const field of UPDATABLE_FIELDS) {
      if (payload[field] !== undefined) {
        player[field] = payload[field];
      }
    }

    await player.save();
    return player;
  }
}