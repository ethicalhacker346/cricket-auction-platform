import mongoose from 'mongoose';
import { PLAYER_ROLES, REGISTRATION_STATUS } from '../config/constants.js';

const walletSchema = new mongoose.Schema(
  {
    initialBudget: { type: Number, required: true, min: 0 },
    spentBudget: { type: Number, default: 0, min: 0 },
    remainingBudget: { type: Number, required: true, min: 0 },
    reservedBudget: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const rosterPlayerSchema = new mongoose.Schema(
  {
    tournamentPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TournamentPlayer',
      required: true,
    },
    boughtPrice: { type: Number, required: true, min: 0 },
    role: {
      type: String,
      enum: Object.values(PLAYER_ROLES),
      required: true,
    },
    boughtAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const tournamentTeamSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    franchiseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Franchise',
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: Object.values(REGISTRATION_STATUS),
      default: REGISTRATION_STATUS.PENDING,
      index: true,
    },
    wallet: {
      type: walletSchema,
      required: true,
    },
    roster: {
      type: [rosterPlayerSchema],
      default: [],
    },
    approvedAt: Date,
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

tournamentTeamSchema.index({ tournamentId: 1, franchiseId: 1 }, { unique: true });

export const TournamentTeam = mongoose.model('TournamentTeam', tournamentTeamSchema);
