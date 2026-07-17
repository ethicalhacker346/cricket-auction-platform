import mongoose from 'mongoose';
import { AUCTION_STATUS, AUCTION_TRANSITIONS, LOT_STATUS } from '../config/constants.js';

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
    // Incremented on every mutation. Bid placement should read this value,
    // then write with a filter that includes the observed version — if
    // another bid landed first the update matches zero documents and the
    // caller retries against fresh state instead of overwriting it blind.
    version: {
      type: Number,
      default: 0,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Tiered bid increment strategy — this is what makes an increment jump
// (e.g. +50K below 1Cr, +1L between 1-5Cr, +2L above) instead of a single
// flat number. Ownership call (see architecture review): Tournament keeps
// `minBidIncrement` as a floor/default rule, but the *strategy* — how many
// tiers, where the breakpoints sit — is an auction-engine concern, because
// it affects live bidding mechanics, not tournament-level policy. It can
// legitimately differ auction-to-auction even within the same tournament
// (e.g. a re-auction for unsold players might use coarser tiers).
const bidIncrementTierSchema = new mongoose.Schema(
  {
    // Upper bound of this tier (exclusive), in the auction's base currency
    // unit. null means "and above" — every tier ladder must have exactly
    // one such tier, and it must be the last one once sorted ascending.
    upTo: {
      type: Number,
      default: null,
      min: 0,
    },
    increment: {
      type: Number,
      required: true,
      min: 1,
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
    // Display name for this specific auction — distinct from
    // Tournament.name (e.g. "MPL Season 1 — Mega Auction"). Optional:
    // clients should fall back to the populated tournament's name for
    // display when this is unset. tournamentId stays unique below, so this
    // is purely a label, not a signal that multiple auctions per
    // tournament are supported yet.
    name: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    bidIncrementTiers: {
      type: [bidIncrementTierSchema],
      required: true,
      validate: {
        validator: function validateTierLadder(tiers) {
          if (!Array.isArray(tiers) || tiers.length === 0) return false;

          const finiteTiers = tiers.filter((t) => t.upTo !== null);
          const openEndedTiers = tiers.filter((t) => t.upTo === null);

          // Exactly one open-ended ("and above") tier, and it must be last
          // once sorted — otherwise a bid above the top finite boundary
          // would have no applicable increment.
          if (openEndedTiers.length !== 1) return false;

          // No duplicate/zero-width or descending boundaries once sorted.
          const sorted = [...finiteTiers].sort((a, b) => a.upTo - b.upTo);
          for (let i = 1; i < sorted.length; i += 1) {
            if (sorted[i].upTo <= sorted[i - 1].upTo) return false;
          }

          return true;
        },
        message:
          'bidIncrementTiers must be sorted ascending, have no duplicate boundaries, and contain exactly one open-ended (upTo: null) tier as the last entry',
      },
    },
    lotTimerSeconds: {
      type: Number,
      required: true,
      min: 5,
      max: 600,
    },
    // Seconds the lot timer resets to whenever a new bid lands. Frontend
    // (AuctionRules.bidResetSeconds) has depended on this since the live
    // auction UI was built; it was never persisted on the backend, so bid
    // placement fell back to the full lotTimerSeconds on every bid instead
    // of the shorter "sniper window" reset. See BidService.placeBid.
    bidResetSeconds: {
      type: Number,
      required: true,
      min: 3,
      max: 120,
      default: 12,
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
    // NOTE: live viewer/spectator count is intentionally NOT a field here.
    // See models/AuctionViewer.js — presence heartbeats would happen far
    // more often than bid mutations and would constantly collide with this
    // document's optimisticConcurrency version, causing bid writes to lose
    // races against viewer churn. Presence lives in its own collection with
    // its own write path; AuctionService.getViewerCount() computes it.
  },
  {
    timestamps: true,
    optimisticConcurrency: true, // FIX: this was missing despite being claimed in HARDENING_NOTES.md
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

auctionSchema.path('completedAt').validate(function validateCompletedAfterStarted(v) {
  if (!v || !this.startedAt) return true;
  return v >= this.startedAt;
}, 'completedAt cannot be before startedAt');

// Single source of truth for "what's the next legal bid step from here" —
// BidService.placeBid should call this rather than re-deriving tier logic,
// so a future change to the ladder shape (e.g. percentage-based tiers)
// only has one call site to update.
auctionSchema.methods.getBidIncrement = function getBidIncrement(currentBid) {
  const sorted = [...this.bidIncrementTiers].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });
  const tier = sorted.find((t) => t.upTo === null || currentBid < t.upTo);
  return tier.increment;
};

auctionSchema.methods.canTransitionTo = function canTransitionTo(nextStatus) {
  const allowed = AUCTION_TRANSITIONS[this.status] || [];
  return allowed.includes(nextStatus);
};

auctionSchema.methods.transitionTo = async function transitionTo(nextStatus, session) {
  if (!this.canTransitionTo(nextStatus)) {
    const err = new Error(`Invalid auction transition: ${this.status} -> ${nextStatus}`);
    err.code = 'INVALID_TRANSITION';
    throw err;
  }
  this.status = nextStatus;
  await this.save({ session });
  return this;
};

// Cap how much log history stays inline on the document; a long-running
// auction otherwise grows this array unbounded and each read/write on the
// auction document gets progressively heavier. Older entries belong in a
// dedicated audit collection if full history must be retained.
const MAX_INLINE_LOGS = 200;
auctionSchema.pre('save', function trimLogs(next) {
  if (this.logs.length > MAX_INLINE_LOGS) {
    this.logs = this.logs.slice(this.logs.length - MAX_INLINE_LOGS);
  }
  next();
});

export const Auction = mongoose.model('Auction', auctionSchema);