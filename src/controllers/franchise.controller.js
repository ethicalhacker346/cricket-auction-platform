import { FranchiseService } from '../services/franchise.service.js';

export const franchiseController = {
  create: async (req, res) => {
    const franchise = await FranchiseService.create(req.user._id, req.body);
    return res.status(201).json({ success: true, data: franchise });
  },

  listMine: async (req, res) => {
    const result = await FranchiseService.listByOwner(req.user._id, req.query);
    return res.json({ success: true, ...result });
  },

  getById: async (req, res) => {
    const franchise = await FranchiseService.getById(req.params.id);
    return res.json({ success: true, data: franchise });
  },
};
