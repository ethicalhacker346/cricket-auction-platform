import { AppError } from '../utils/helpers.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { User } from '../models/User.js';

export async function authenticate(req, _res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = header.slice(7);

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub);

    if (!user || !user.isActive) {
      return next(new AppError('User account is inactive or not found', 401));
    }

    req.user = user;
    req.auth = decoded;
    return next();
  } catch {
    return next(new AppError('Invalid or expired access token', 401));
  }
}

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    return next();
  };
}

export function optionalAuthenticate(req, _res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return next();
  }

  return authenticate(req, _res, next);
}
