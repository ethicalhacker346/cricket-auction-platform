import mongoose from 'mongoose';
import { ROUND_STATUS } from '../config/constants.js';

const auctionRoundSchema = new mongoose.Schema(
  {
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    type: {
      type: String,
      trim: true,
      default: 'normal',
    },
    status: {
      type: String,
      enum: Object.values(ROUND_STATUS),
      default: ROUND_STATUS.PENDING,
      index: true,
    },
    playerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TournamentPlayer',
      },
    ],
    startedAt: Date,
    completedAt: Date,
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

auctionRoundSchema.index({ auctionId: 1, order: 1 }, { unique: true });

export const AuctionRound = mongoose.model('AuctionRound', auctionRoundSchema);
