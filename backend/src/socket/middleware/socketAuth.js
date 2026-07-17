/**
 * socketAuth.js — Socket.IO Authentication Middleware
 * ----------------------------------------------------------------
 * Supports both authenticated and anonymous (spectator) connections.
 * Auth method mirrors REST auth.js but adapted for socket handshake.
 *
 * Token sources (priority):
 *   1. socket.handshake.auth.token (Socket.IO standard)
 *   2. socket.handshake.headers.authorization: Bearer <token>
 *   3. socket.handshake.query.token (fallback for legacy clients)
 *
 * If token present -> verify, attach user to socket.
 * If missing -> allow as anonymous if opts.allowAnonymous = true (default)
 *
 * Keeps req.user shape compatible with REST (user._id, user.role)
 */

import jwt from 'jsonwebtoken';

// Lazy-loaded project verifier if available — keeps this file decoupled
let projectVerifyFn = null;
try {
  // Dynamic import attempt — will fail gracefully if path doesn't exist in standalone run
  const mod = await import('../../utils/jwt.js').catch(() => null);
  if (mod?.verifyAccessToken) projectVerifyFn = mod.verifyAccessToken;
} catch (_) {
  // ignore
}

function extractToken(socket) {
  // 1. socket.io auth object (recommended)
  if (socket.handshake?.auth?.token) {
    return socket.handshake.auth.token;
  }
  // 2. Authorization header
  const authHeader = socket.handshake?.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // 3. Query param
  if (socket.handshake?.query?.token) {
    return socket.handshake.query.token;
  }
  // 4. Custom header x-access-token (some clients)
  if (socket.handshake?.headers?.['x-access-token']) {
    return socket.handshake.headers['x-access-token'];
  }
  return null;
}

function buildUserFromPayload(decoded) {
  // Normalize shape expected by existing services
  return {
    _id: decoded.sub || decoded.id || decoded._id,
    id: decoded.sub || decoded.id || decoded._id,
    role: decoded.role,
    email: decoded.email,
    // keep raw
    ...decoded,
  };
}

/**
 * Optional authentication — anonymous spectators allowed
 * Use as: io.use(socketAuth({ allowAnonymous: true }))
 */
export function socketAuth(options = {}) {
  const { allowAnonymous = true, requiredRoles = null } = options;

  return async (socket, next) => {
    const token = extractToken(socket);

    if (!token) {
      if (allowAnonymous) {
        socket.user = null;
        socket.auth = null;
        socket.isAnonymous = true;
        return next();
      }
      return next(new Error('Authentication required: no token provided'));
    }

    try {
      let decoded;

      if (projectVerifyFn) {
        decoded = projectVerifyFn(token);
      } else {
        // Fallback verification using jsonwebtoken directly
        const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'dev-secret';
        decoded = jwt.verify(token, secret);
      }

      const user = buildUserFromPayload(decoded);

      // Optional role check at connection level (rare)
      if (requiredRoles && !requiredRoles.includes(user.role)) {
        return next(new Error(`Insufficient role: requires ${requiredRoles.join(',')}`));
      }

      socket.user = user;
      socket.auth = decoded;
      socket.userId = user._id?.toString() || user.id?.toString();
      socket.isAnonymous = false;
      socket.join(`user:${socket.userId}`); // personal room for direct notifications

      return next();
    } catch (err) {
      console.warn('[socketAuth] Token verification failed:', err.message);
      if (allowAnonymous) {
        // Downgrade to anonymous instead of rejecting
        socket.user = null;
        socket.auth = null;
        socket.isAnonymous = true;
        return next();
      }
      return next(new Error('Invalid or expired token'));
    }
  };
}

/**
 * Strict authentication — only logged-in users
 */
export function requireSocketAuth(options = {}) {
  return socketAuth({ ...options, allowAnonymous: false });
}

/**
 * Role guard for socket events — call inside handler
 * Example: in auction handler, only ORGANIZER can openLot via REST,
 * but if you ever add socket-based organizer actions, use this.
 */
export function requireRoles(socket, ...roles) {
  if (!socket.user) throw new Error('Authentication required');
  if (!roles.includes(socket.user.role)) {
    throw new Error(`Insufficient permissions: requires ${roles.join(',')}`);
  }
}

export default socketAuth;