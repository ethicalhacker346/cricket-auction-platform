import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { adminDashboardController } from '../controllers/admin-dashboard.controller.js';
import { adminResourceController } from '../controllers/admin-resource.controller.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/dashboard/overview', asyncHandler(adminDashboardController.overview));
router.get('/users', asyncHandler(adminResourceController.listUsers));
router.get('/tournaments', asyncHandler(adminResourceController.listTournaments));
router.get('/players', asyncHandler(adminResourceController.listPlayers));
router.get('/franchises', asyncHandler(adminResourceController.listFranchises));
router.get('/auctions', asyncHandler(adminResourceController.listAuctions));
router.get('/audit-logs', asyncHandler(adminResourceController.listAuditLogs));
router.get('/system-health', asyncHandler(adminResourceController.systemHealth));

export default router;
