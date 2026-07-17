import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
  },
});

export const bidRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many bid requests, slow down',
  },
});

// ─── Password Reset Request Limiter ────────────────────────────────────────
// Stricter: 3 requests per hour per IP
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyGenerator: (req) => `fp_ip_${req.ip}`,
});

// ─── Password Reset Per-Email Limiter ─────────────────────────────────────
// Additional layer: 2 requests per hour per email address
export const forgotPasswordEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 2,
  keyGenerator: (req) => `fp_email_${req.body?.email?.toLowerCase()?.trim() || req.ip}`,
  skip: (req) => !req.body?.email, // Skip if no email provided (will fail validation anyway)
});
