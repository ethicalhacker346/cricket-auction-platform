import mongoose from 'mongoose';
import { TOURNAMENT_STATUS } from '../config/constants.js';

const tournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(TOURNAMENT_STATUS),
      default: TOURNAMENT_STATUS.DRAFT,
      index: true,
    },
    season: {
      type: String,
      trim: true,
    },
    venue: {
      type: String,
      trim: true,
    },
    playerRegistrationOpen: {
      type: Boolean,
      default: false,
    },
    teamRegistrationOpen: {
      type: Boolean,
      default: false,
    },
    registrationDeadline: Date,
    auctionDate: Date,
    maxTeams: {
      type: Number,
      min: 2,
      default: 8,
    },
    squadSize: {
      type: Number,
      min: 5,
      default: 15,
    },
    defaultPurse: {
      type: Number,
      min: 0,
      default: 10_000_000,
    },
    minBidIncrement: {
      type: Number,
      min: 1,
      default: 50_000,
    },
    lotTimerSeconds: {
      type: Number,
      min: 5,
      default: 30,
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

export const Tournament = mongoose.model('Tournament', tournamentSchema);
