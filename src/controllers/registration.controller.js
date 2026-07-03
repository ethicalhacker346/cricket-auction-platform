import { RegistrationService } from '../services/registration.service.js';

export const registrationController = {
  registerPlayer: async (req, res) => {
    const registration = await RegistrationService.registerPlayer(
      req.params.tournamentId,
      req.user._id,
      req.body
    );
    return res.status(201).json({ success: true, data: registration });
  },

  listPlayers: async (req, res) => {
    const result = await RegistrationService.listPlayers(req.params.tournamentId, req.query);
    return res.json({ success: true, ...result });
  },

  verifyPlayer: async (req, res) => {
    const registration = await RegistrationService.verifyPlayer(
      req.params.tournamentId,
      req.params.registrationId,
      req.user
    );
    return res.json({ success: true, data: registration });
  },

  rejectPlayer: async (req, res) => {
    const registration = await RegistrationService.rejectPlayer(
      req.params.tournamentId,
      req.params.registrationId,
      req.user,
      req.body.reason
    );
    return res.json({ success: true, data: registration });
  },

  registerTeam: async (req, res) => {
    const team = await RegistrationService.registerTeam(
      req.params.tournamentId,
      req.user._id,
      req.body
    );
    return res.status(201).json({ success: true, data: team });
  },

  listTeams: async (req, res) => {
    const result = await RegistrationService.listTeams(req.params.tournamentId, req.query);
    return res.json({ success: true, ...result });
  },

  approveTeam: async (req, res) => {
    const team = await RegistrationService.approveTeam(
      req.params.tournamentId,
      req.params.teamId,
      req.user
    );
    return res.json({ success: true, data: team });
  },

  rejectTeam: async (req, res) => {
    const team = await RegistrationService.rejectTeam(
      req.params.tournamentId,
      req.params.teamId,
      req.user,
      req.body.reason
    );
    return res.json({ success: true, data: team });
  },

  exportSquads: async (req, res) => {
    const squads = await RegistrationService.exportSquads(req.params.tournamentId);
    return res.json({ success: true, data: squads });
  },
};
