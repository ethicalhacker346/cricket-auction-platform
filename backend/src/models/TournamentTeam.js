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
    rejectedReason: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true, // critical: wallet is mutated on every bid
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

tournamentTeamSchema.index({ tournamentId: 1, franchiseId: 1 }, { unique: true });
tournamentTeamSchema.index({ tournamentId: 1, status: 1 });

tournamentTeamSchema.pre('validate', function enforceRejectionReason(next) {
  if (this.status === REGISTRATION_STATUS.REJECTED && !this.rejectedReason) {
    return next(new Error('rejectedReason is required when status is REJECTED'));
  }
  next();
});

// The core invariant of the whole bidding system: money never appears or
// disappears. If this ever fails validation, something upstream skipped the
// reserve/release/commit methods below and wrote to wallet fields directly.
tournamentTeamSchema.pre('validate', function enforceWalletInvariant(next) {
  const { initialBudget, spentBudget, remainingBudget, reservedBudget } = this.wallet;
  const total = spentBudget + remainingBudget + reservedBudget;
  // Guard against floating-point drift while still catching real corruption.
  if (Math.abs(total - initialBudget) > 0.01) {
    return next(
      new Error(
        `Wallet invariant violated: spent(${spentBudget}) + remaining(${remainingBudget}) + reserved(${reservedBudget}) != initial(${initialBudget})`
      )
    );
  }
  next();
});

// --- Wallet operations -----------------------------------------------------
// These centralize the math so services never touch wallet.* fields inline.
// They mutate the in-memory document; the caller is still responsible for
// wrapping the eventual .save() in a transaction session alongside the
// corresponding Bid/TournamentPlayer/Auction writes (see design doc, section 2).

tournamentTeamSchema.methods.canAfford = function canAfford(amount) {
  return this.wallet.remainingBudget >= amount;
};

tournamentTeamSchema.methods.reserve = function reserve(amount) {
  if (!this.canAfford(amount)) {
    const err = new Error('Insufficient remaining budget to reserve this amount');
    err.code = 'INSUFFICIENT_BUDGET';
    throw err;
  }
  this.wallet.remainingBudget -= amount;
  this.wallet.reservedBudget += amount;
};

tournamentTeamSchema.methods.releaseReservation = function releaseReservation(amount) {
  if (this.wallet.reservedBudget < amount) {
    const err = new Error('Cannot release more than currently reserved');
    err.code = 'INVALID_RELEASE';
    throw err;
  }
  this.wallet.reservedBudget -= amount;
  this.wallet.remainingBudget += amount;
};

// Converts a reservation into a permanent spend (lot settled SOLD).
tournamentTeamSchema.methods.commitSpend = function commitSpend(amount) {
  if (this.wallet.reservedBudget < amount) {
    const err = new Error('Cannot commit more than currently reserved');
    err.code = 'INVALID_COMMIT';
    throw err;
  }
  this.wallet.reservedBudget -= amount;
  this.wallet.spentBudget += amount;
};

tournamentTeamSchema.virtual("budgetUtilization").get(function () {

    console.log("TEAM:", this._id);

    console.log("WALLET:", this.wallet);

    if (!this.wallet) {
        console.log("BROKEN DOCUMENT");
        return 0;
    }

    return Number(
        (
            this.wallet.spentBudget /
            this.wallet.initialBudget
        ).toFixed(4)
    );
});

export const TournamentTeam = mongoose.model('TournamentTeam', tournamentTeamSchema);
