import { Notification } from '../models/Notification.js';
import { assertFound, parsePagination, buildPaginatedResponse } from '../utils/helpers.js';

export class NotificationService {
  // `type` must be one of NOTIFICATION_TYPES (config/constants.js). Previously
  // callers passed free-text strings like 'bid' / 'registration', which don't
  // match the model's enum and would throw a Mongoose validation error on
  // every Notification.create() call — fixed at the call sites, not here.
  static async create({ userId, type, title, message, data = {}, priority }) {
    return Notification.create({
      userId,
      type,
      priority,
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
    // `read: true` triggers the model's pre('save') hook to set readAt and
    // the TTL expiresAt — but findOneAndUpdate bypasses document middleware
    // by default, so those two fields must be set explicitly here too.
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true, readAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      { new: true }
    );
    // Previously returned null silently on a wrong/foreign id — the
    // controller then responded 200 with data:null, which reads as success
    // to a client that didn't actually get its notification marked read.
    return assertFound(notification, 'Notification not found');
  }

  static async markAllAsRead(userId) {
    await Notification.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
    );
  }
}