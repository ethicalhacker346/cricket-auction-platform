/**
 * middleware/auctionRateLimiter.js — Bid-specific protection
 * -----------------------------------------------------------
 * • Strict rate limits on bid endpoints
 * • Per-user tracking (not just IP)
 * • Different limits for authenticated vs anonymous
 */

import { rateLimit } from 'express-rate-limit';
import { logger } from '../config/logger.js';

export const bidRateLimiter = rateLimit({
  windowMs: 2000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res, next, options) => {
    logger.warn({ userId: req.user?.id, ip: req.ip }, 'Bid rate limit exceeded');
    res.status(429).json({
      error: 'Too many bids. Please wait a moment.',
      retryAfter: Math.ceil(options.windowMs / 1000),
    });
  },
  skip: (req) => req.method === 'GET',
});

export const roomJoinRateLimiter = rateLimit({
  windowMs: 60000,
  max: 30000,
  standardHeaders: true,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many room join attempts. Please slow down.' });
  },
});