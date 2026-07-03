import { PlayerService } from '../services/player.service.js';

export const playerController = {
  create: async (req, res) => {
    const player = await PlayerService.createProfile(req.user._id, req.body);
    return res.status(201).json({ success: true, data: player });
  },

  me: async (req, res) => {
    const player = await PlayerService.getMyProfile(req.user._id);
    return res.json({ success: true, data: player });
  },

  updateMe: async (req, res) => {
    const player = await PlayerService.updateProfile(req.user._id, req.body);
    return res.json({ success: true, data: player });
  },

  getById: async (req, res) => {
    const player = await PlayerService.getById(req.params.id);
    return res.json({ success: true, data: player });
  },

  list: async (req, res) => {
    const result = await PlayerService.list(req.query);
    return res.json({ success: true, ...result });
  },
};
