import mongoose from 'mongoose';
import { PLAYER_ROLES } from '../config/constants.js';

const MIN_AGE_YEARS = 15;

const playerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator(v) {
          if (!v) return true;
          const cutoff = new Date();
          cutoff.setFullYear(cutoff.getFullYear() - MIN_AGE_YEARS);
          return v <= cutoff && v.getTime() > 0;
        },
        message: `Player must be at least ${MIN_AGE_YEARS} years old`,
      },
    },
    nationality: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    primaryRole: {
      type: String,
      enum: Object.values(PLAYER_ROLES),
      required: true,
      index: true,
    },
    battingStyle: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    bowlingStyle: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    profileImage: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^https?:\/\//.test(v),
        message: 'profileImage must be a valid URL',
      },
    },
    bio: {
      type: String,
      maxlength: 1000,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

// Supports "browse players" screens filtering by role + active state.
playerSchema.index({ primaryRole: 1, isActive: 1 });
// Lightweight name search without pulling in a full-text search service yet.
playerSchema.index({ fullName: 'text' });

export const Player = mongoose.model('Player', playerSchema);
