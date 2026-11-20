import { env } from '../config/env.js';
import { createScopedRateLimiter, rateLimitActor } from './auctionRateLimiter.js';

const ID = '[a-f\\d]{24}';
const AUCTION_READ = new RegExp(`^/api/v1/auctions/${ID}(?:/(?:snapshot|live|permissions|actions|rounds|bids|viewers/count))?$`, 'i');
const TOURNAMENT_READ = new RegExp(`^/api/v1/tournaments/${ID}/(?:auction|players(?:/approved)?)$`, 'i');
const PRESENCE = new RegExp(`^/api/v1/auctions/${ID}/viewers/(?:heartbeat|leave)$`, 'i');
const BID = new RegExp(`^/api/v1/auctions/${ID}/bids$`, 'i');
const COMMAND = new RegExp(`^/api/v1/auctions/${ID}(?:/(?:start|pause|resume|complete|undo|lot/(?:open|sold|unsold|time)|rounds(?:/${ID}(?:/advance)?)?|players/${ID}/permanent-unsold))?$`, 'i');

/** Exact method/path allowlist: unknown endpoints retain the general budget. */
export function auctionTrafficClass(req) {
  const path = req.path.replace(/\/+$/, '');
  if ((req.method === 'GET' || req.method === 'HEAD') && (AUCTION_READ.test(path) || TOURNAMENT_READ.test(path))) return 'read';
  if (req.method === 'POST' && PRESENCE.test(path)) return 'presence';
  if (req.method === 'POST' && BID.test(path)) return 'bid';
  if (['POST', 'PATCH', 'DELETE'].includes(req.method) && COMMAND.test(path)) return 'command';
  return 'general';
}

/**
 * Watching a multi-hour auction must not consume the allowance for bidding.
 * Shared venue NATs get a generous anonymous-read budget; signed-in callers
 * have cryptographically verified per-account buckets, not caller-supplied IDs.
 */
export function createApiRateLimiter({
  generalMax = env.RATE_LIMIT_MAX,
  generalWindowMs = env.RATE_LIMIT_WINDOW_MS,
  readMax = env.AUCTION_READ_RATE_LIMIT_MAX,
  guestMax = env.AUCTION_GUEST_RATE_LIMIT_MAX,
  commandMax = env.AUCTION_COMMAND_RATE_LIMIT_MAX,
  development = env.NODE_ENV === 'development',
} = {}) {
  const multiplier = development ? 20 : 1;
  const create = (scope, max, windowMs = 60_000) => createScopedRateLimiter(scope, { max: max * multiplier, windowMs });
  const general = create('general', generalMax, generalWindowMs);
  const reads = create('auction-read', readMax);
  const guests = create('auction-guest-read', guestMax);
  const presence = create('auction-presence', guestMax);
  const commands = create('auction-command', commandMax);
  const bids = create('auction-bid-ingress', 600);
  return (req, res, next) => {
    const actor = rateLimitActor(req);
    const traffic = auctionTrafficClass(req);
    const limiter = traffic === 'read' ? (actor.startsWith('user:') ? reads : guests)
      : traffic === 'presence' ? presence
        : traffic === 'bid' ? bids
          : traffic === 'command' ? commands : general;
    return limiter(req, res, next);
  };
}

// These security-sensitive limits are NOT relaxed in development or bypassed
// by the auction classification. Every store is shared via Redis when present.
export const authRateLimiter = createScopedRateLimiter('authentication', {
  windowMs: 15 * 60 * 1000, max: 1000,
});
export const forgotPasswordRateLimiter = createScopedRateLimiter('password-reset-ip', {
  windowMs: 60 * 60 * 1000, max: 3,
  keyGenerator: (req) => `ip:${req.ip}`,
});
export const forgotPasswordEmailLimiter = createScopedRateLimiter('password-reset-email', {
  windowMs: 60 * 60 * 1000, max: 2,
  keyGenerator: (req) => `email:${req.body?.email?.toLowerCase()?.trim() || req.ip}`,
  skip: (req) => !req.body?.email,
});
export const imageUploadLimiter = createScopedRateLimiter('image-upload', {
  windowMs: 15 * 60 * 1000, max: 10,
  keyGenerator: (req) => req.user?._id ? `user:${req.user._id}` : `ip:${req.ip}`,
});
