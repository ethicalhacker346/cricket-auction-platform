import { AdminDashboardService } from '../services/admin-dashboard.service.js';

export const adminDashboardController = {
  overview: async (req, res) => {
    const data = await AdminDashboardService.getOverview({
      recentActivityLimit: req.query.recentActivityLimit,
    });

    return res.json({ success: true, data });
  },
};
