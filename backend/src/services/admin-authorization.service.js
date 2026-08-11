import { USER_ROLES } from '../config/constants.js';
import { AppError } from '../utils/helpers.js';

/**
 * Central admin boundary. Route middleware owns authorization; dashboard
 * aggregation code remains a pure read-model service.
 */
export class AdminAuthorizationService {
  static assertAdmin(user) {
    if (!user?._id) {
      throw new AppError('Authentication required', 401);
    }

    if (user.isActive === false) {
      throw new AppError('Account is deactivated', 403);
    }

    if (user.role !== USER_ROLES.ADMIN) {
      throw new AppError('Admin access required', 403);
    }

    return user;
  }
}
