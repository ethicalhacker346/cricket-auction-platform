import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { createRateLimitStore } from './rateLimitStore.js';

/** Identity here chooses a bucket ONLY. It never authenticates/authorizes a request. */
export function rateLimitActor(req) {
  if (req.rateLimitActor) return req.rateLimitActor;
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (token) {
    try {
      const claims = verifyAccessToken(token);
      if (typeof claims.sub === 'string' && /^[a-f\d]{24}$/i.test(claims.sub)) {
        return (req.rateLimitActor = `user:${claims.sub}`);
      }
    } catch { /* Invalid/expired tokens get the IP budget, never a fresh user bucket. */ }
  }
  return (req.rateLimitActor = `ip:${req.ip}`);
}

export function createScopedRateLimiter(scope, { windowMs, max, keyGenerator = rateLimitActor, ...options }) {
  return rateLimit({
    windowMs, max, keyGenerator,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    requestPropertyName: `rateLimit_${scope.replaceAll('-', '_')}`,
    store: createRateLimitStore(scope),
    // X-Forwarded-For is intentionally ignored when TRUST_PROXY_HOPS=0.
    validate: { xForwardedForHeader: false },
    handler: (req, res) => {
      const info = req[`rateLimit_${scope.replaceAll('-', '_')}`];
      const retryAfter = Math.max(1, Math.ceil(((info?.resetTime?.getTime() ?? Date.now() + windowMs) - Date.now()) / 1000));
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        success: false, code: 'RATE_LIMITED', scope, retryAfter,
        message: scope === 'auction-bid-burst'
          ? `Bids are arriving too quickly. Please wait ${retryAfter} second${retryAfter === 1 ? '' : 's'} before bidding again.`
          : `Request allowance reached. Please retry in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
      });
    },
    ...options,
  });
}

// Short per-account burst protection is independent of viewing/heartbeats and
// of every OTHER owner at the same venue. Authentication runs before this.
export const bidRateLimiter = createScopedRateLimiter('auction-bid-burst', {
  windowMs: 2_000,
  max: env.NODE_ENV === 'development' ? 80 : 8,
  keyGenerator: (req) => `user:${req.user._id.toString()}`,
});
