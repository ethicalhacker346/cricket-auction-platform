import mongoose from 'mongoose';
import { AUCTION_STATUS, LOT_STATUS } from '../config/constants.js';

const auctionLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    metadata: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const liveStateSchema = new mongoose.Schema(
  {
    currentTournamentPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TournamentPlayer',
    },
    currentRoundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuctionRound',
    },
    currentHighestBid: {
      type: Number,
      default: 0,
      min: 0,
    },
    highestBidderTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TournamentTeam',
    },
    remainingTimeSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    lotStatus: {
      type: String,
      enum: Object.values(LOT_STATUS),
      default: LOT_STATUS.PENDING,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const auctionSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(AUCTION_STATUS),
      default: AUCTION_STATUS.DRAFT,
      index: true,
    },
    bidIncrement: {
      type: Number,
      required: true,
      min: 1,
    },
    lotTimerSeconds: {
      type: Number,
      required: true,
      min: 5,
    },
    scheduledAt: Date,
    startedAt: Date,
    completedAt: Date,
    liveState: {
      type: liveStateSchema,
      default: () => ({}),
    },
    logs: {
      type: [auctionLogSchema],
      default: [],
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

export const Auction = mongoose.model('Auction', auctionSchema);
