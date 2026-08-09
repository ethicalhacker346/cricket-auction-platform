import { FranchiseService } from '../services/franchise.service.js';

export const franchiseController = {
  // ── existing ──
  create: async (req, res) => {
    const franchise = await FranchiseService.create(req.user._id, req.body);
    return res.status(201).json({ success: true, data: franchise });
  },

  listMine: async (req, res) => {
    const result = await FranchiseService.listByOwner(req.user._id, req.query);
    return res.json({ success: true, data: result });
  },

  getById: async (req, res) => {
    const franchise = await FranchiseService.getById(req.params.id);
    return res.json({ success: true, data: franchise });
  },

  update: async (req, res) => {
    const franchise = await FranchiseService.update(
      req.params.id,
      req.user._id,
      req.body
    );
    return res.json({ success: true, data: franchise });
  },

  // ── NEW ────────────────────────────────────────────────────────────────
  uploadLogo: async (req, res, next) => {
    try {
      const result = await FranchiseService.uploadLogo(
        req.params.id,
        req.user._id,
        req.file.buffer
      );
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  removeLogo: async (req, res, next) => {
    try {
      const franchise = await FranchiseService.removeLogo(req.params.id, req.user._id);
      return res.json({ success: true, data: franchise });
    } catch (err) {
      next(err);
    }
  },
};