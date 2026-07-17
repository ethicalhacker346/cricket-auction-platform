import { Franchise } from '../models/Franchise.js';
import { AppError, assertFound, slugify, parsePagination, buildPaginatedResponse } from '../utils/helpers.js';

export class FranchiseService {
  static async create(ownerId, payload) {
    const slug = slugify(payload.name);

    // CHANGE: Franchise.slug is now a GLOBALLY unique index (see
    // models/Franchise.js hardening notes), not scoped to {ownerId, slug}.
    // Checking only within this owner's franchises would miss a collision
    // with a different owner's franchise and let this call crash on the
    // model's own unique-index constraint with a raw duplicate-key error
    // instead of a clean 409.
    const existing = await Franchise.findOne({ slug });
    if (existing) {
      throw new AppError(
        'A franchise with this name already exists — try a more specific name',
        409
      );
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

  static async update(id, ownerId, payload) {
  // 1. Load franchise
    const franchise = assertFound(
      await Franchise.findById(id),
      'Franchise not found'
    );

  // 2. Verify ownership
    await this.assertOwner(franchise, ownerId);

  // 3. Handle name/slug changes
    // Replace the slug check block with this:
  if (payload.name && payload.name.trim() !== franchise.name) {
    const newSlug = slugify(payload.name);

  // Ultra-safe version - avoid $ne completely for _id
    const existing = await Franchise.findOne({ slug: newSlug });

    if (existing && existing._id.toString() !== id) {
      throw new AppError(
        'A franchise with this name already exists — try a more specific name',
        409
      );
    }

    franchise.name = payload.name;
    franchise.slug = newSlug;
   }

  // 4. Whitelist editable fields
    const editableFields = [
      'description',
      'logo',
      'city',
      'state',
      'country',
      'primaryColor',
      'secondaryColor',
    ];

    for (const field of editableFields) {
      if (payload[field] !== undefined) {
        franchise[field] = payload[field];
     }
    }

  // 5. Save
    await franchise.save();

    return franchise;
  }

  static async assertOwner(franchise, userId) {
    if (franchise.ownerId.toString() !== userId.toString()) {
      throw new AppError('You do not own this franchise', 403);
    }
  }
}