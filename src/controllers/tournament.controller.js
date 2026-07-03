import { TournamentService } from '../services/tournament.service.js';

export const tournamentController = {
  create: async (req, res) => {
    const tournament = await TournamentService.create(req.user._id, req.body);
    return res.status(201).json({ success: true, data: tournament });
  },

  list: async (req, res) => {
    const result = await TournamentService.list(req.query);
    return res.json({ success: true, ...result });
  },

  getById: async (req, res) => {
    const tournament = await TournamentService.getById(req.params.id);
    return res.json({ success: true, data: tournament });
  },

  update: async (req, res) => {
    const tournament = await TournamentService.update(req.params.id, req.user, req.body);
    return res.json({ success: true, data: tournament });
  },

  openPlayerRegistration: async (req, res) => {
    const tournament = await TournamentService.openPlayerRegistration(req.params.id, req.user);
    return res.json({ success: true, data: tournament });
  },

  openTeamRegistration: async (req, res) => {
    const tournament = await TournamentService.openTeamRegistration(req.params.id, req.user);
    return res.json({ success: true, data: tournament });
  },

  markTeamsApproved: async (req, res) => {
    const tournament = await TournamentService.markTeamsApproved(req.params.id, req.user);
    return res.json({ success: true, data: tournament });
  },
};
