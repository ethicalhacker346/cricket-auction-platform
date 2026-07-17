// VERIFIED against services/franchise.service.js — no changes needed.
// FranchiseService.create() now checks slug collisions globally (the model's
// slug index changed from {ownerId, slug} to global-unique) and throws a
// clean AppError(409) either way, so the controller's error handling is
// unaffected by that change.
import { FranchiseService } from '../services/franchise.service.js';

export const franchiseController = {
  create: async (req, res) => {
    const franchise = await FranchiseService.create(req.user._id, req.body);
    return res.status(201).json({ success: true, data: franchise });
  },

  listMine: async (req, res) => {
    const result = await FranchiseService.listByOwner(req.user._id, req.query);
    console.log( result )
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

};