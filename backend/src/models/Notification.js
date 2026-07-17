import mongoose from 'mongoose';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from '../config/constants.js';

const READ_NOTIFICATION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days after being read

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      default: NOTIFICATION_TYPES.SYSTEM,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(NOTIFICATION_PRIORITY),
      default: NOTIFICATION_PRIORITY.NORMAL,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: Date,
    // Set only once `read` flips true; a TTL index on this field auto-purges
    // old read notifications so the collection doesn't grow unbounded, while
    // unread notifications (expiresAt: null) are kept indefinitely.
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Unread-count / inbox screen: "unread notifications for this user, newest first"
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

notificationSchema.pre('save', function setExpiryOnRead(next) {
  if (this.isModified('read') && this.read && !this.readAt) {
    this.readAt = new Date();
    this.expiresAt = new Date(Date.now() + READ_NOTIFICATION_TTL_SECONDS * 1000);
  }
  next();
});

export const Notification = mongoose.model('Notification', notificationSchema);