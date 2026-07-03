import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { authController } from '../controllers/auth.controller.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from '../validators/schemas.js';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), asyncHandler(authController.register));
router.post('/login', authRateLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post('/refresh', validate(refreshTokenSchema), asyncHandler(authController.refresh));
router.post('/logout', authenticate, asyncHandler(authController.logout));
router.get('/me', authenticate, asyncHandler(authController.me));

export default router;
