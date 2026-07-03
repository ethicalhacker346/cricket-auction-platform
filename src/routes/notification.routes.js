import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notificationController } from '../controllers/notification.controller.js';
import { idParamSchema } from '../validators/schemas.js';

const router = Router();

router.get('/', authenticate, asyncHandler(notificationController.list));
router.patch('/:id/read', authenticate, validate(idParamSchema, 'params'), asyncHandler(notificationController.markAsRead));
router.patch('/read-all', authenticate, asyncHandler(notificationController.markAllAsRead));

export default router;
