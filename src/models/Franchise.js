import mongoose from 'mongoose';

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
    },
    logo: String,
    city: {
      type: String,
      trim: true,
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
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

franchiseSchema.index({ ownerId: 1, slug: 1 }, { unique: true });

export const Franchise = mongoose.model('Franchise', franchiseSchema);
