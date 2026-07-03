import mongoose from 'mongoose';
import { PLAYER_ROLES, REGISTRATION_STATUS } from '../config/constants.js';

const tournamentPlayerSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(REGISTRATION_STATUS),
      default: REGISTRATION_STATUS.PENDING,
      index: true,
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0,
      default: 100_000,
    },
    category: {
      type: String,
      trim: true,
    },
    primaryRole: {
      type: String,
      enum: Object.values(PLAYER_ROLES),
      required: true,
    },
    isSold: {
      type: Boolean,
      default: false,
      index: true,
    },
    soldToTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TournamentTeam',
    },
    soldPrice: Number,
    soldAt: Date,
    verifiedAt: Date,
    rejectedReason: String,
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

tournamentPlayerSchema.index({ tournamentId: 1, playerId: 1 }, { unique: true });

export const TournamentPlayer = mongoose.model('TournamentPlayer', tournamentPlayerSchema);
