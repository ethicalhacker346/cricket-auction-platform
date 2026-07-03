import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { USER_ROLES } from '../config/constants.js';
import { env } from '../config/env.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.PLAYER,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.refreshTokenHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, env.BCRYPT_SALT_ROUNDS);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
