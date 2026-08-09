import { TournamentService } from '../services/tournament.service.js';

export const tournamentController = {
  create: async (req, res, next) => {
    try {
      const tournament = await TournamentService.create(req.user._id, req.body);
      return res.status(201).json({ success: true, data: tournament });
    } catch (err) {
      next(err);
    }
  },

  list: async (req, res, next) => {
    try {
      const result = await TournamentService.list(req.query);

      // Flat envelope expected by frontend
      return res.json({
        success: true,
        data: result.data,
        total: result.pagination?.total ?? result.data.length,
        page: result.pagination?.page ?? 1,
        limit: result.pagination?.limit ?? 20,
      });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req, res, next) => {
    try {
      const tournament = await TournamentService.getById(req.params.id);
      return res.json({ success: true, data: tournament });
    } catch (err) {
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const tournament = await TournamentService.update(req.params.id, req.user, req.body);
      console.log(req.user);
      return res.json({ success: true, data: tournament });
      console.log(tournament.organizerId);
    } catch (err) {
      next(err);
    }
  },
  // ── NEW ────────────────────────────────────────────────────────────────
  uploadLogo: async (req, res, next) => {
    try {
      const result = await TournamentService.uploadLogo(
        req.params.id,
        req.user,
        req.file.buffer
      );
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  removeLogo: async (req, res, next) => {
    try {
      const tournament = await TournamentService.removeLogo(req.params.id, req.user);
      return res.json({ success: true, data: tournament });
    } catch (err) {
      next(err);
    }
  },
  openPlayerRegistration: async (req, res, next) => {
    try {
      const tournament = await TournamentService.openPlayerRegistration(req.params.id, req.user);
      return res.json({ success: true, data: tournament });
    } catch (err) {
      next(err);
    }
  },

  openTeamRegistration: async (req, res, next) => {
    try {
      const tournament = await TournamentService.openTeamRegistration(req.params.id, req.user);
      return res.json({ success: true, data: tournament });
    } catch (err) {
      next(err);
    }
  },

  markTeamsApproved: async (req, res, next) => {
    try {
      const tournament = await TournamentService.markTeamsApproved(req.params.id, req.user);
      return res.json({ success: true, data: tournament });
    } catch (err) {
      next(err);
    }
  },

  scheduleAuction: async (req, res, next) => {
    try {
      const { auctionDate } = req.body;
      const tournament = await TournamentService.scheduleAuction(req.params.id, req.user, auctionDate);
      return res.json({ success: true, data: tournament });
    } catch (err) {
      next(err);
    }
  },

  startAuction: async (req, res, next) => {
    try {
      const tournament = await TournamentService.startAuction(req.params.id, req.user);
      return res.json({ success: true, data: tournament });
    } catch (err) {
      next(err);
    }
  },

  completeAuction: async (req, res, next) => {
    try {
      const tournament = await TournamentService.completeAuction(req.params.id, req.user);
      return res.json({ success: true, data: tournament });
    } catch (err) {
      next(err);
    }
  },

  completeTournament: async (req, res, next) => {
    try {
      const tournament = await TournamentService.completeTournament(req.params.id, req.user);
      return res.json({ success: true, data: tournament });
    } catch (err) {
      next(err);
    }
  },

  cancel: async (req, res, next) => {
    try {
      const tournament = await TournamentService.cancel(req.params.id, req.user);
      return res.json({ success: true, data: tournament });
    } catch (err) {
      next(err);
    }
  },
};