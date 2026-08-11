import mongoose from 'mongoose';
import { BID_STATUS } from '../config/constants.js';

const bidSchema = new mongoose.Schema(
  {
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true,
    },
    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuctionRound',
      required: true,
      index: true,
    },
    tournamentTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TournamentTeam',
      required: true,
      index: true,
    },
    tournamentPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TournamentPlayer',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'amount must be an integer (store currency in minor units if fractional values are needed)',
      },
    },
    status: {
      type: String,
      enum: Object.values(BID_STATUS),
      default: BID_STATUS.WINNING,
      index: true,
    },
    placedAt: {
      type: Date,
      default: Date.now,
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

// Bid history for a given lot, most recent first.
bidSchema.index({ auctionId: 1, tournamentPlayerId: 1, placedAt: -1 });
// Fast lookup of "the current leading bid" without scanning full history —
// used on every placeBid call to validate the new amount against the floor.
bidSchema.index({ auctionId: 1, tournamentPlayerId: 1, status: 1 });

export const Bid = mongoose.model('Bid', bidSchema);