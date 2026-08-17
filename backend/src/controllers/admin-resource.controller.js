import { AdminResourceService } from '../services/admin-resource.service.js';

export const adminResourceController = {
  listUsers: async (req, res) => res.json({ success: true, ...(await AdminResourceService.listUsers(req.query)) }),
  listTournaments: async (req, res) => res.json({ success: true, ...(await AdminResourceService.listTournaments(req.query)) }),
  listPlayers: async (req, res) => res.json({ success: true, ...(await AdminResourceService.listPlayers(req.query)) }),
  listFranchises: async (req, res) => res.json({ success: true, ...(await AdminResourceService.listFranchises(req.query)) }),
  listAuctions: async (req, res) => res.json({ success: true, ...(await AdminResourceService.listAuctions(req.query)) }),
  listAuditLogs: async (req, res) => res.json({ success: true, ...(await AdminResourceService.listAuditLogs(req.query)) }),
  systemHealth: async (req, res) => res.json({ success: true, data: await AdminResourceService.getSystemHealth() }),
};
