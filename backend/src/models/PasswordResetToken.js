import mongoose from 'mongoose';
import crypto from 'crypto';

const passwordResetTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
      // CRITICAL: Don't index nulls — sparse index only indexes documents
      // where usedAt exists (is a Date, not null)
      index: { sparse: true },
    },
  },
  {
    timestamps: true,
    // Prevent Mongoose from stripping null fields during save
    minimize: false,
  }
);

// TTL Index: MongoDB auto-deletes when expiresAt is reached
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Generate a cryptographically secure random token and its SHA-256 hash.
 * 64 bytes = 512 bits entropy → 128 hex characters.
 */
passwordResetTokenSchema.statics.generateToken = function generateToken() {
  const rawToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
};

/**
 * Hash a raw token for database comparison.
 */
passwordResetTokenSchema.statics.hashToken = function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

/**
 * ════════════════════════════════════════════════════════════════════════
 * NATIVE DRIVER CLEANUP — Bypasses Mongoose's broken Date caster
 * ════════════════════════════════════════════════════════════════════════
 * 
 * Mongoose has a bug where { $ne: null } on Date fields in deleteMany()
 * causes CastError. We bypass Mongoose entirely and use the native MongoDB
 * driver collection for these operations.
 */
passwordResetTokenSchema.statics.cleanupUsedTokens = async function cleanupUsedTokens(userId) {
  const collection = mongoose.connection.collection('passwordresettokens');
  return collection.deleteMany({
    user: new mongoose.Types.ObjectId(userId),
    usedAt: { $ne: null }, // Native driver handles this correctly
  });
};

passwordResetTokenSchema.statics.cleanupExpiredTokens = async function cleanupExpiredTokens(userId) {
  const collection = mongoose.connection.collection('passwordresettokens');
  return collection.deleteMany({
    user: new mongoose.Types.ObjectId(userId),
    usedAt: null,
    expiresAt: { $lt: new Date() },
  });
};

passwordResetTokenSchema.statics.countActiveTokens = async function countActiveTokens(userId) {
  // findOne/find work fine with Date operators — only deleteMany is broken
  return this.countDocuments({
    user: userId,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
};

export const PasswordResetToken = mongoose.model(
  'PasswordResetToken',
  passwordResetTokenSchema
);