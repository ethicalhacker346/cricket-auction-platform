import mongoose from 'mongoose';
import { PLAYER_ROLES, REGISTRATION_STATUS, LOT_OUTCOME } from '../config/constants.js';

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
    // --- registration lifecycle (verification) ---
    status: {
      type: String,
      enum: Object.values(REGISTRATION_STATUS),
      default: REGISTRATION_STATUS.PENDING,
      index: true,
    },
    verifiedAt: Date,
    rejectedReason: {
      type: String,
      maxlength: 500,
    },
    // --- auction lifecycle, independent of registration status ---
    lotOutcome: {
      type: String,
      enum: Object.values(LOT_OUTCOME),
      default: LOT_OUTCOME.NOT_LISTED,
      index: true,
    },
    auctionRoundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuctionRound',
    },
    basePrice: {
      type: Number,
      
      min: 0,
      default: 100,
    },
    // Set when the organizer manually sets/edits a player's base price
    // (see RegistrationService.setPlayerBasePrice). Not touched by the
    // initial registration default.
    basePriceUpdatedAt: Date,
    category: {
      type: String,
      trim: true,
      maxlength: 60,
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
    soldPrice: {
      type: Number,
      min: 0,
    },
    soldAt: Date,
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

tournamentPlayerSchema.index({ tournamentId: 1, playerId: 1 }, { unique: true });
// Verification queue screen: "pending players for this tournament"
tournamentPlayerSchema.index({ tournamentId: 1, status: 1 });
// Round-progression engine: "which approved-but-unsold players remain"
tournamentPlayerSchema.index({ tournamentId: 1, lotOutcome: 1 });

tournamentPlayerSchema.pre('validate', function enforceRejectionReason(next) {
  if (this.status === REGISTRATION_STATUS.REJECTED && !this.rejectedReason) {
    return next(new Error('rejectedReason is required when status is REJECTED'));
  }
  next();
});

// Sold-state fields are all-or-nothing: partial writes here are how squad
// exports and wallet reconciliation quietly go wrong in production.
tournamentPlayerSchema.pre('validate', function enforceSoldFieldsConsistency(next) {
  const soldFields = [this.soldToTeamId, this.soldPrice, this.soldAt];
  const anyPresent = soldFields.some((f) => f !== undefined && f !== null);
  const allPresent = soldFields.every((f) => f !== undefined && f !== null);

  if (anyPresent && !allPresent) {
    return next(new Error('soldToTeamId, soldPrice, and soldAt must be set together'));
  }
  if (this.isSold && !allPresent) {
    return next(new Error('isSold=true requires soldToTeamId, soldPrice, and soldAt'));
  }
  if (this.soldPrice != null && this.soldPrice < this.basePrice) {
    return next(new Error('soldPrice cannot be less than basePrice'));
  }
  next();
});

export const TournamentPlayer = mongoose.model('TournamentPlayer', tournamentPlayerSchema);