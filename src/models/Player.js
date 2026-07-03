import mongoose from 'mongoose';
import { PLAYER_ROLES } from '../config/constants.js';

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
    dateOfBirth: Date,
    nationality: {
      type: String,
      trim: true,
    },
    primaryRole: {
      type: String,
      enum: Object.values(PLAYER_ROLES),
      required: true,
    },
    battingStyle: String,
    bowlingStyle: String,
    profileImage: String,
    bio: {
      type: String,
      maxlength: 1000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Player = mongoose.model('Player', playerSchema);
