import mongoose from 'mongoose';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const franchiseSchema = new mongoose.Schema(
  {
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
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (v) => SLUG_RE.test(v),
        message: 'slug must be lowercase alphanumeric with single hyphens (e.g. "hyderabad-tigers")',
      },
    },
    logo: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^https?:\/\//.test(v),
        message: 'logo must be a valid URL',
      },
    },
    city: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// CHANGE FROM ORIGINAL: slug uniqueness moved from {ownerId, slug} to global.
// Rationale: slugs are the public URL identifier for a franchise page
// (/franchises/:slug). Scoping uniqueness per-owner allows two different
// owners to collide on the same public URL, which breaks routing/SEO. If you
// specifically want to allow "the same owner running two same-named
// franchises across seasons," rename this field rather than relaxing the
// global constraint.
franchiseSchema.index({ slug: 1 }, { unique: true });
franchiseSchema.index({ ownerId: 1, isActive: 1 });

export const Franchise = mongoose.model('Franchise', franchiseSchema);