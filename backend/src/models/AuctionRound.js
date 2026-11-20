import mongoose from 'mongoose';
import { ROUND_STATUS, ROUND_TYPE } from '../config/constants.js';

const outcomeSummarySchema = new mongoose.Schema({
  sold: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  unsold: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  permanentUnsold: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
}, { _id: false });

export const UNSOLD_PASS_INDEXES = [
  [{ auctionId: 1, unsoldPass: 1 }, {
    name: 'unique_unsold_pass_number', unique: true,
    partialFilterExpression: { type: ROUND_TYPE.UNSOLD, unsoldPass: { $type: 'number' } },
  }],
  [{ auctionId: 1, type: 1 }, {
    name: 'one_open_unsold_pass_per_auction', unique: true,
    partialFilterExpression: { type: ROUND_TYPE.UNSOLD, status: { $in: [ROUND_STATUS.PENDING, ROUND_STATUS.ACTIVE] } },
  }],
];

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
      enum: Object.values(ROUND_TYPE),
      maxlength: 40,
    },
    // Engine-owned sequence, independent of display order and editable names.
    // Optional only for pre-migration history; all newly generated passes set it.
    unsoldPass: { type: Number, min: 1, validate: Number.isSafeInteger, immutable: true },
    // Freeze aggregate outcomes when a pass closes. Relisting changes a
    // player's CURRENT status, never the historical round's result counters.
    outcomeSummary: { type: outcomeSummarySchema, default: undefined },
    category:{
      type: String,
      
    },
    status: {
      type: String,
      enum: Object.values(ROUND_STATUS),
      default: ROUND_STATUS.PENDING,
      index: true,
    },
    playerIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'TournamentPlayer',
        },
      ],
      validate: {
        validator(arr) {
          // Duplicate player entries in a round are almost always a UI bug
          // (double-add) rather than an intentional re-listing within the
          // same round; re-listing belongs in a later round instead.
          const unique = new Set(arr.map(String));
          return unique.size === arr.length;
        },
        message: 'playerIds must not contain duplicates within a round',
      },
    },
    
    startedAt: Date,
    completedAt: Date,
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

auctionRoundSchema.index({ auctionId: 1, order: 1 }, { unique: true });

// Replaces the former one-unsold-round-for-the-entire-auction constraint.
// Existing deployments MUST run migrate-unsold-passes.mjs before enabling this.
for (const [keys, options] of UNSOLD_PASS_INDEXES) auctionRoundSchema.index(keys, options);

auctionRoundSchema.path('completedAt').validate(function validateCompletedAfterStarted(v) {
  if (!v || !this.startedAt) return true;
  return v >= this.startedAt;
}, 'completedAt cannot be before startedAt');

// A round can't legitimately be marked ACTIVE or COMPLETED with no players —
// that state almost certainly means the "auto-advance to next round" logic
// ran ahead of round configuration finishing.
auctionRoundSchema.pre('validate', function requirePlayersWhenActive(next) {
  if ((this.status === ROUND_STATUS.ACTIVE || this.status === ROUND_STATUS.COMPLETED) && this.playerIds.length === 0) {
    return next(new Error(`Round cannot be ${this.status} with an empty playerIds list`));
  }
  next();
});

// The engine-managed unsold phase follows every normal round.
// Normal rounds may not be inserted after any unsold pass.
auctionRoundSchema.pre('validate', async function enforceUnsoldRoundIsLast(next) {
  if (this.type !== ROUND_TYPE.UNSOLD) {
    const unsoldExists = await mongoose.model('AuctionRound').exists({
      auctionId: this.auctionId,
      type: ROUND_TYPE.UNSOLD,
      order: { $lte: this.order },
    }).session(this.$session());
    if (unsoldExists) {
      return next(new Error('Normal rounds cannot be added after the unsold round'));
    }
  }
  next();
});

// NEW: Guard against manual tampering of the engine-managed unsold round.
auctionRoundSchema.pre('validate', function enforceUnsoldRoundPlayerIds(next) {
  if (this.type === ROUND_TYPE.UNSOLD && this.isModified('playerIds') && !this.isNew) {
    return next(new Error('playerIds on the unsold round are managed automatically by the auction engine'));
  }
  next();
});


export const AuctionRound = mongoose.model('AuctionRound', auctionRoundSchema);