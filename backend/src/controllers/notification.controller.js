// VERIFIED against services/notification.service.js.
// No controller code changes needed, but note the coordinated service fix:
// NotificationService.markAsRead() now throws AppError(404) via assertFound()
// instead of silently returning null on a wrong/foreign notification id.
// Previously this controller would have responded 200 with data:null in
// that case — that's fixed at the service boundary, not here, but it does
// mean markAsRead can now reject where it silently succeeded before.
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