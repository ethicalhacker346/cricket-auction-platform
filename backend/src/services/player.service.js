import { Player } from '../models/Player.js';
import { AppError, assertFound, parsePagination, buildPaginatedResponse } from '../utils/helpers.js';
import * as ImageService from '../services/image.service.js';

const UPDATABLE_FIELDS = [
  'fullName', 'dateOfBirth', 'nationality', 'primaryRole',
  'battingStyle', 'bowlingStyle', 'profileImage', 'bio',
];

export class PlayerService {
  static async createProfile(userId, payload) {
    const existing = await Player.findOne({ userId });
    if (existing) {
      throw new AppError('Player profile already exists for this user', 409);
    }
    return Player.create({ userId, ...payload });
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

  /* ─── LIBRARY PATH: PATCH /players/me ───────────────────────────────────
     User selects a pre-made image. We accept the absolute URL, extract a
     publicId ONLY if it's one of OUR Cloudinary assets, and clean up any
     previously uploaded custom image after the DB save succeeds.          */

  static async updateProfile(userId, payload) {
    const player = await PlayerService.getMyProfile(userId);
    const oldPublicId = player.profileImagePublicId; // capture before mutation

    for (const field of UPDATABLE_FIELDS) {
      if (payload[field] !== undefined) {
        if (field === 'profileImage') {
          // Empty string / null → remove image
          player.profileImage = payload.profileImage || undefined;
          // Only track publicId for OUR Cloudinary assets (security)
          player.profileImagePublicId = ImageService.extractPublicId(payload.profileImage) || undefined;
        } else {
          player[field] = payload[field];
        }
      }
    }

    await player.save();

    /* Cleanup happens AFTER successful persistence. If the DB write had
       failed, we would NOT have deleted the old asset — preventing a
       broken-reference scenario. */
    if (oldPublicId && oldPublicId !== player.profileImagePublicId) {
      ImageService.destroy(oldPublicId).catch(() => {});
    }

    return player;
  }

  /* ─── CUSTOM UPLOAD PATH: PATCH /players/me/profile-image ───────────────
     User uploads their own file. Stream to Cloudinary, save URL + publicId,
     then non-blocking delete the previous asset.                         */

  static async uploadProfileImage(userId, fileBuffer) {
    const player = await PlayerService.getMyProfile(userId);
    const oldPublicId = player.profileImagePublicId;

    const uploaded = await ImageService.upload(
      fileBuffer,
      'player',
      player._id.toString(),
      'profileImage'
    );

    player.profileImage = uploaded.url;
    player.profileImagePublicId = uploaded.publicId;
    await player.save();

    if (oldPublicId) {
      ImageService.destroy(oldPublicId).catch(() => {});
    }

    return {
      profileImage: uploaded.url,
      meta: {
        format: uploaded.format,
        width: uploaded.width,
        height: uploaded.height,
        bytes: uploaded.bytes,
      },
    };
  }

  /* ─── REMOVE PATH: DELETE /players/me/profile-image ───────────────────── */

  static async removeProfileImage(userId) {
    const player = await PlayerService.getMyProfile(userId);
    const oldPublicId = player.profileImagePublicId;

    player.profileImage = undefined;
    player.profileImagePublicId = undefined;
    await player.save();

    if (oldPublicId) {
      await ImageService.destroy(oldPublicId);
    }

    return player;
  }
}