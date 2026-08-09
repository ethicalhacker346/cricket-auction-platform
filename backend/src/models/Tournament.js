import mongoose from 'mongoose';
import { TOURNAMENT_STATUS, TOURNAMENT_TRANSITIONS } from '../config/constants.js';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
      validate: {
        validator: (v) => SLUG_RE.test(v),
        message: 'slug must be lowercase alphanumeric with single hyphens',
      },
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
      maxlength: 40,
    },
    venue: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    // Absolute http(s) URL only — matches Franchise.js's `logo` and
    // Player.js's `profileImage` validators exactly. LOGO_LIBRARY on the
    // frontend stores root-relative paths, so callers MUST resolve to an
    // absolute URL before submitting (see toAbsoluteUrl in
    // TournamentForm.tsx) or this validator rejects it.
    logo: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^https?:\/\//.test(v),
        message: 'logo must be a valid URL',
      },
    },
    logoPublicId: {
      type: String,
      trim: true,
      select: false,
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
      max: 40,
      default: 8,
    },
    squadSize: {
      type: Number,
      min: 5,
      max: 40,
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
      max: 600,
      default: 30,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'INR',
      minlength: 3,
      maxlength: 3,
    },
    playersCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    teamsCount: {           // Good to add this too for consistency
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true, // guards concurrent status writes via __v
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

tournamentSchema.index({ organizerId: 1, status: 1 });
tournamentSchema.index({ playersCount: 1 });
tournamentSchema.index({ teamsCount: 1 });

tournamentSchema.path('registrationDeadline').validate(function validateDeadlineBeforeAuction(v) {
  if (!v || !this.auctionDate) return true;
  return v <= this.auctionDate;
}, 'registrationDeadline must be on or before auctionDate');

// --- State machine enforcement -------------------------------------------
// Nothing outside this file should ever do `tournament.status = X; save()`.
// Route through transitionTo() so illegal jumps (e.g. DRAFT -> AUCTION_RUNNING)
// fail loudly instead of silently corrupting the lifecycle every screen and
// socket handler relies on.
tournamentSchema.methods.canTransitionTo = function canTransitionTo(nextStatus) {
  const allowed = TOURNAMENT_TRANSITIONS[this.status] || [];
  return allowed.includes(nextStatus);
};

tournamentSchema.methods.transitionTo = async function transitionTo(nextStatus, session) {
  if (!this.canTransitionTo(nextStatus)) {
    const err = new Error(`Invalid tournament transition: ${this.status} -> ${nextStatus}`);
    err.code = 'INVALID_TRANSITION';
    throw err;
  }
  this.status = nextStatus;
  await this.save({ session });
  return this;
};

export const Tournament = mongoose.model('Tournament', tournamentSchema);