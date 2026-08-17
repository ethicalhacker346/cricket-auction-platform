import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

export function createTokenPair(user) {
  const payload = {
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
  };
  console.log('[JWT] Creating token pair:', {
    userId: user._id.toString(),
    payload,
  });

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({ sub: user._id.toString() }),
  };
}
