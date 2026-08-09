// Added setPlayerBasePrice, mirroring the verify/reject pattern below —
// just forwards to RegistrationService.setPlayerBasePrice and returns the
// updated registration. Everything else here is unchanged.
import { RegistrationService } from '../services/registration.service.js';

/**
 * Robust tournamentId extractor.
 * Validation middleware (validate(schema, 'params')) strips unknown keys
 * from req.params, so req.params.tournamentId disappears on PATCH routes.
 * We fall back to parsing req.originalUrl which is immutable.
 */
function getTournamentId(req) {
  // 1. Direct param from registration router (mergeParams: true)
  if (req.params.tournamentId) return req.params.tournamentId;

  // 2. Direct param from tournament router (/:id/players)
  if (req.params.id) return req.params.id;

  // 3. Fallback: parse from URL — handles both /registrations/ and /players/
  const match = req.originalUrl?.match(/\/tournaments\/([^/]+)\/(?:registrations|players)/);
  return match?.[1];
}

export const registrationController = {
  registerPlayer: async (req, res) => {
    const registration = await RegistrationService.registerPlayer(
      getTournamentId(req),
      req.user._id,
      req.body
    );
    return res.status(201).json({ success: true, data: registration });
  },

  listPlayers: async (req, res) => {
    const result = await RegistrationService.listPlayers(getTournamentId(req), req.query, req.user?._id);
    return res.json({ success: true, ...result });
  },

  verifyPlayer: async (req, res) => {
    const registration = await RegistrationService.verifyPlayer(
      getTournamentId(req),
      req.params.registrationId,
      req.user
    );
    return res.json({ success: true, data: registration });
  },

  rejectPlayer: async (req, res) => {
    const registration = await RegistrationService.rejectPlayer(
      getTournamentId(req),
      req.params.registrationId,
      req.user,
      req.body.reason
    );
    return res.json({ success: true, data: registration });
  },

  setPlayerBasePrice: async (req, res) => {
    const registration = await RegistrationService.setPlayerBasePrice(
      getTournamentId(req),
      req.params.registrationId,
      req.user,
      req.body.basePrice
    );
    return res.json({ success: true, data: registration });
  },

  registerTeam: async (req, res) => {
    const team = await RegistrationService.registerTeam(
      getTournamentId(req),
      req.user._id,
      req.body
    );
    return res.status(201).json({ success: true, data: team });
  },

  listTeams: async (req, res) => {
    const result = await RegistrationService.listTeams(getTournamentId(req), req.query, req.user?._id);
    return res.json({ success: true, ...result });
  },

  approveTeam: async (req, res) => {
    const team = await RegistrationService.approveTeam(
      getTournamentId(req),
      req.params.teamId,
      req.user
    );
    return res.json({ success: true, data: team });
  },

  rejectTeam: async (req, res) => {
    const team = await RegistrationService.rejectTeam(
      getTournamentId(req),
      req.params.teamId,
      req.user,
      req.body.reason
    );
    return res.json({ success: true, data: team });
  },

  exportSquads: async (req, res) => {
    const squads = await RegistrationService.exportSquads(getTournamentId(req));
    return res.json({ success: true, data: squads });
  },

  listApprovedPlayers: async (req, res) => {
    const result = await RegistrationService.listApprovedPlayers(
      getTournamentId(req),
      req.query,
      req.user?._id
    );
    return res.json({ success: true, ...result });
  },
};