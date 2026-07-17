import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { AppError, assertFound } from '../utils/helpers.js';
import { createTokenPair, verifyRefreshToken } from '../utils/jwt.js';
import { USER_ROLES } from '../config/constants.js';
import { EmailService } from './email.service.js';
import { env } from '../config/env.js';

const PUBLIC_REGISTER_ROLES = [
  USER_ROLES.PLAYER,
  USER_ROLES.FRANCHISE_OWNER,
  USER_ROLES.ORGANIZER,
];

const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
const MAX_ACTIVE_RESET_TOKENS = 3;

export class AuthService {
  // ─── Existing Methods (unchanged) ───────────────────────────────────────
  static async register(payload) {
    const existing = await User.findOne({ email: payload.email });
    if (existing) throw new AppError('Email already registered', 409);

    const role = payload.role && PUBLIC_REGISTER_ROLES.includes(payload.role)
      ? payload.role
      : USER_ROLES.PLAYER;

    const user = await User.create({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      role,
      phone: payload.phone,
    });

    const tokens = createTokenPair(user);
    await AuthService.storeRefreshToken(user, tokens.refreshToken);
    return { user, tokens };
  }

  static async login({ email, password }) {
    const user = await User.findOne({ email }).select(
      '+password +refreshTokenHash +failedLoginAttempts +lockUntil'
    );
    assertFound(user, 'Invalid email or password');

    if (!user.isActive) throw new AppError('Account is deactivated', 403);
    if (user.isLocked()) {
      throw new AppError('Account temporarily locked due to repeated failed logins — try again later', 423);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.registerFailedLogin();
      throw new AppError('Invalid email or password', 401);
    }

    await user.registerSuccessfulLogin();
    const tokens = createTokenPair(user);
    await AuthService.storeRefreshToken(user, tokens.refreshToken);

    user.password = undefined;
    user.refreshTokenHash = undefined;
    return { user, tokens };
  }

  static async refresh(refreshToken) {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.sub).select('+refreshTokenHash');
    assertFound(user, 'Invalid refresh token');

    if (!user.refreshTokenHash) throw new AppError('Refresh token revoked', 401);

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isValid) throw new AppError('Invalid refresh token', 401);

    const tokens = createTokenPair(user);
    await AuthService.storeRefreshToken(user, tokens.refreshToken);
    return { user, tokens };
  }

  static async logout(userId) {
    await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
  }

  static async getProfile(userId) {
    const user = await User.findById(userId);
    return assertFound(user, 'User not found');
  }

  static async storeRefreshToken(user, refreshToken) {
    user.refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await user.save();
  }

  // ════════════════════════════════════════════════════════════════════════
  // PASSWORD RESET — PRODUCTION HARDENED
  // ════════════════════════════════════════════════════════════════════════

  static async requestPasswordReset({ email, clientIp }) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Account enumeration prevention: always return generic message
    if (!user) {
      return { message: 'If an account exists with this email, a reset link has been sent.' };
    }

    // ═════════════════════════════════════════════════════════════════════
    // FIX: Use native MongoDB driver for deleteMany to bypass Mongoose bug
    // where { $ne: null } on Date fields causes CastError in deleteMany()
    // ═════════════════════════════════════════════════════════════════════
    await PasswordResetToken.cleanupUsedTokens(user._id);
    await PasswordResetToken.cleanupExpiredTokens(user._id);

    // Token spam prevention
    const activeTokenCount = await PasswordResetToken.countActiveTokens(user._id);
    if (activeTokenCount >= MAX_ACTIVE_RESET_TOKENS) {
      return { message: 'If an account exists with this email, a reset link has been sent.' };
    }

    // Generate secure token
    const { rawToken, tokenHash } = PasswordResetToken.generateToken();

    await PasswordResetToken.create({
      user: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
    });

    // Build reset URL using server-side env (prevents Host Header Poisoning)
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    // Fire-and-forget email (don't block HTTP response)
    EmailService.sendPasswordReset({
      to: user.email,
      name: user.name.split(' ')[0],
      resetUrl,
    }).catch((err) => {
      console.error('Failed to send password reset email:', err.message);
    });

    return { message: 'If an account exists with this email, a reset link has been sent.' };
  }

  static async verifyResetToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.length !== 128) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const tokenHash = PasswordResetToken.hashToken(rawToken);
    const now = new Date();

    const resetToken = await PasswordResetToken.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: now },
    }).populate('user', 'email name');

    if (!resetToken) throw new AppError('Invalid or expired reset token', 400);

    return { valid: true, email: resetToken.user.email };
  }

  static async resetPassword({ rawToken, newPassword }) {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.length !== 128) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const tokenHash = PasswordResetToken.hashToken(rawToken);
    const now = new Date();

    const resetToken = await PasswordResetToken.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: now },
    }).populate('user');

    if (!resetToken) throw new AppError('Invalid or expired reset token', 400);

    const user = resetToken.user;

    // Update password (User pre-save hook handles bcrypt)
    user.password = newPassword;
    resetToken.usedAt = now;

    // Security: invalidate all sessions
    user.refreshTokenHash = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;

    await Promise.all([user.save(), resetToken.save()]);

    // Cleanup: delete all other reset tokens for this user
    // Use native driver here too for consistency
    const collection = mongoose.connection.collection('passwordresettokens');
    await collection.deleteMany({
      user: new mongoose.Types.ObjectId(user._id),
      _id: { $ne: new mongoose.Types.ObjectId(resetToken._id) },
    });

    // Notify user
    EmailService.sendPasswordChanged({
      to: user.email,
      name: user.name.split(' ')[0],
    }).catch((err) => {
      console.error('Failed to send password changed notification:', err.message);
    });

    return { message: 'Password reset successful. Please sign in with your new password.' };
  }
}