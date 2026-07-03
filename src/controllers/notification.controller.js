import { NotificationService } from '../services/notification.service.js';

export const notificationController = {
  list: async (req, res) => {
    const result = await NotificationService.listForUser(req.user._id, req.query);
    return res.json({ success: true, ...result });
  },

  markAsRead: async (req, res) => {
    const notification = await NotificationService.markAsRead(req.user._id, req.params.id);
    return res.json({ success: true, data: notification });
  },

  markAllAsRead: async (req, res) => {
    await NotificationService.markAllAsRead(req.user._id);
    return res.json({ success: true, message: 'All notifications marked as read' });
  },
};
