import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AppError, assertFound } from '../utils/helpers.js';
import { createTokenPair, verifyRefreshToken } from '../utils/jwt.js';
import { USER_ROLES } from '../config/constants.js';

const PUBLIC_REGISTER_ROLES = [
  USER_ROLES.PLAYER,
  USER_ROLES.FRANCHISE_OWNER,
  USER_ROLES.ORGANIZER,
];

export class AuthService {
  static async register(payload) {
    const existing = await User.findOne({ email: payload.email });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

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
    const user = await User.findOne({ email }).select('+password +refreshTokenHash');
    assertFound(user, 'Invalid email or password');

    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

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

    if (!user.refreshTokenHash) {
      throw new AppError('Refresh token revoked', 401);
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isValid) {
      throw new AppError('Invalid refresh token', 401);
    }

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
}
