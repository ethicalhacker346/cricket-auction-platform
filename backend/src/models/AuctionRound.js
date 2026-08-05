import mongoose from 'mongoose';
import { ROUND_STATUS, ROUND_TYPE } from '../config/constants.js';

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

auctionRoundSchema.index(
  { auctionId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: ROUND_TYPE.UNSOLD } }
);

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

// NEW: The unsold round must always be the last one in the order.
// Normal rounds may not be inserted after it.
auctionRoundSchema.pre('validate', async function enforceUnsoldRoundIsLast(next) {
  if (this.type !== ROUND_TYPE.UNSOLD) {
    const unsoldExists = await mongoose.model('AuctionRound').exists({
      auctionId: this.auctionId,
      type: ROUND_TYPE.UNSOLD,
      order: { $lte: this.order },
    });
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