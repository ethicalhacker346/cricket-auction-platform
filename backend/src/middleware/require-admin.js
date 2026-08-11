import { AdminAuthorizationService } from '../services/admin-authorization.service.js';

/**
 * Must run after `authenticate`, which is responsible for populating req.user.
 */
export function requireAdmin(req, _res, next) {
  try {
    AdminAuthorizationService.assertAdmin(req.user);
    return next();
  } catch (error) {
    return next(error);
  }
}