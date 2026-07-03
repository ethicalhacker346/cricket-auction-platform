import { Franchise } from '../models/Franchise.js';
import { AppError, assertFound, slugify, parsePagination, buildPaginatedResponse } from '../utils/helpers.js';

export class FranchiseService {
  static async create(ownerId, payload) {
    const slug = slugify(payload.name);

    const existing = await Franchise.findOne({ ownerId, slug });
    if (existing) {
      throw new AppError('You already have a franchise with this name', 409);
    }

    return Franchise.create({
      ownerId,
      slug,
      ...payload,
    });
  }

  static async listByOwner(ownerId, query = {}) {
    const { page, limit, skip } = parsePagination(query);

    const [data, total] = await Promise.all([
      Franchise.find({ ownerId, isActive: true }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Franchise.countDocuments({ ownerId, isActive: true }),
    ]);

    return buildPaginatedResponse({ data, total, page, limit });
  }

  static async getById(id) {
    return assertFound(await Franchise.findById(id), 'Franchise not found');
  }

  static async assertOwner(franchise, userId) {
    if (franchise.ownerId.toString() !== userId.toString()) {
      throw new AppError('You do not own this franchise', 403);
    }
  }
}
