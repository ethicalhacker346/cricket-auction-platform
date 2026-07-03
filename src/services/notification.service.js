import { Notification } from '../models/Notification.js';
import { parsePagination, buildPaginatedResponse } from '../utils/helpers.js';

export class NotificationService {
  static async create({ userId, type, title, message, data = {} }) {
    return Notification.create({
      userId,
      type,
      title,
      message,
      data,
    });
  }

  static async listForUser(userId, query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { userId };

    if (query.read !== undefined) {
      filter.read = query.read === 'true';
    }

    const [data, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
    ]);

    return buildPaginatedResponse({ data, total, page, limit });
  }

  static async markAsRead(userId, notificationId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true, readAt: new Date() },
      { new: true }
    );
  }

  static async markAllAsRead(userId) {
    await Notification.updateMany({ userId, read: false }, { read: true, readAt: new Date() });
  }
}
