import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { adminDashboardController } from '../controllers/admin-dashboard.controller.js';

const router = Router();

router.get(
  '/dashboard/overview',
  authenticate,
  requireAdmin,
  asyncHandler(adminDashboardController.overview),
);

export default router;
