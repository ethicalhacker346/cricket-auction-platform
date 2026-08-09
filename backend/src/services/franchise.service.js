import { Franchise } from '../models/Franchise.js';
import { AppError, assertFound, slugify, parsePagination, buildPaginatedResponse } from '../utils/helpers.js';
import * as ImageService from '../services/image.service.js';

export class FranchiseService {
  static async create(ownerId, payload) {
    const slug = slugify(payload.name);
    const existing = await Franchise.findOne({ slug });
    if (existing) {
      throw new AppError('A franchise with this name already exists', 409);
    }
    return Franchise.create({ ownerId, slug, ...payload });
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

  /* ─── LIBRARY PATH: PATCH /franchises/:id ─────────────────────────────── */

  static async update(id, ownerId, payload) {
    const franchise = assertFound(
      await Franchise.findById(id),
      'Franchise not found'
    );
    await this.assertOwner(franchise, ownerId);

    const oldLogoPublicId = franchise.logoPublicId;

    // Name / slug change
    if (payload.name && payload.name.trim() !== franchise.name) {
      const newSlug = slugify(payload.name);
      const existing = await Franchise.findOne({ slug: newSlug });
      if (existing && existing._id.toString() !== id) {
        throw new AppError('A franchise with this name already exists', 409);
      }
      franchise.name = payload.name;
      franchise.slug = newSlug;
    }

    const editableFields = [
      'description', 'logo', 'city', 'state',
      'country', 'primaryColor', 'secondaryColor',
    ];

    for (const field of editableFields) {
      if (payload[field] !== undefined) {
        if (field === 'logo') {
          franchise.logo = payload.logo || undefined;
          franchise.logoPublicId = ImageService.extractPublicId(payload.logo) || undefined;
        } else {
          franchise[field] = payload[field];
        }
      }
    }

    await franchise.save();

    if (oldLogoPublicId && oldLogoPublicId !== franchise.logoPublicId) {
      ImageService.destroy(oldLogoPublicId).catch(() => {});
    }

    return franchise;
  }

  /* ─── CUSTOM UPLOAD PATH: PATCH /franchises/:id/logo ──────────────────── */

  static async uploadLogo(id, ownerId, fileBuffer) {
    const franchise = assertFound(
      await Franchise.findById(id),
      'Franchise not found'
    );
    await this.assertOwner(franchise, ownerId);

    const oldPublicId = franchise.logoPublicId;

    const uploaded = await ImageService.upload(
      fileBuffer,
      'franchise',
      id,
      'logo'
    );

    franchise.logo = uploaded.url;
    franchise.logoPublicId = uploaded.publicId;
    await franchise.save();

    if (oldPublicId) {
      ImageService.destroy(oldPublicId).catch(() => {});
    }

    return { logo: uploaded.url, meta: uploaded };
  }

  /* ─── REMOVE PATH: DELETE /franchises/:id/logo ────────────────────────── */

  static async removeLogo(id, ownerId) {
    const franchise = assertFound(
      await Franchise.findById(id),
      'Franchise not found'
    );
    await this.assertOwner(franchise, ownerId);

    const oldPublicId = franchise.logoPublicId;

    franchise.logo = undefined;
    franchise.logoPublicId = undefined;
    await franchise.save();

    if (oldPublicId) {
      await ImageService.destroy(oldPublicId);
    }

    return franchise;
  }

  static async assertOwner(franchise, userId) {
    if (franchise.ownerId.toString() !== userId.toString()) {
      throw new AppError('You do not own this franchise', 403);
    }
  }
}