import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  authRateLimiter,
  forgotPasswordRateLimiter,
  forgotPasswordEmailLimiter,
} from '../middleware/rateLimiter.js';
import { authController } from '../controllers/auth.controller.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyTokenSchema,
} from '../validators/schemas.js';

const router = Router();

// ─── Existing Routes ────────────────────────────────────────────────────────
router.post('/register', authRateLimiter, validate(registerSchema), asyncHandler(authController.register));
router.post('/login', authRateLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post('/refresh', validate(refreshTokenSchema), asyncHandler(authController.refresh));
router.post('/logout', authenticate, asyncHandler(authController.logout));
router.get('/me', authenticate, asyncHandler(authController.me));

// ════════════════════════════════════════════════════════════════════════
// NEW: PASSWORD RESET ROUTES
// ════════════════════════════════════════════════════════════════════════

// POST /api/auth/forgot-password
// Layered rate limiting: IP-based + email-based
router.post(
  '/forgot-password',
  forgotPasswordRateLimiter,
  forgotPasswordEmailLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword)
);

// GET /api/auth/verify-reset-token?token=xxx
// Verify token validity before showing reset form
router.get(
  '/verify-reset-token',
  validate(verifyTokenSchema, 'query'),
  asyncHandler(authController.verifyResetToken)
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  authRateLimiter, // Reuse auth limiter to prevent brute force on token
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword)
);

export default router;