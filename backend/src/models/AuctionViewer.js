import mongoose from 'mongoose';

// Presence tracking for the "N people watching" indicator on the live
// auction screen.
//
// Deliberately a separate collection from Auction, not a field on it:
// Auction uses optimisticConcurrency (see Auction.js) so every bid write
// races on `version`. A viewer heartbeating every ~15s — multiplied across
// however many organizers/franchise owners/spectators have the live screen
// open — would hit that same document constantly and either stall bid
// writes behind retry storms, or have viewer writes lost to bid churn.
// Presence is orthogonal to auction state: it gets its own document, its
// own write path, and can never block or be blocked by a bid.
const auctionViewerSchema = new mongoose.Schema(
  {
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true,
    },
    // Client-supplied stable id for the viewing session — the authenticated
    // user's id when logged in, or a per-tab anonymous id for spectators if
    // the organizer opens the room to unauthenticated viewers. Opaque to
    // this schema; uniqueness per auction is what's enforced below.
    viewerId: {
      type: String,
      required: true,
    },
    // Populated when known, null for anonymous spectators. Kept separate
    // from viewerId so an anonymous viewer who logs in mid-session can be
    // upgraded without changing the identity the client already heartbeats
    // with.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// One presence row per (auction, viewer) — a reconnect or repeat heartbeat
// updates lastSeenAt on the existing row via upsert instead of piling up
// duplicates that would inflate the count.
auctionViewerSchema.index({ auctionId: 1, viewerId: 1 }, { unique: true });

// How long a viewer is still counted as "present" without a fresh
// heartbeat. Kept short enough that a closed tab drops off the count
// quickly, long enough to tolerate one missed heartbeat from network jitter.
export const VIEWER_HEARTBEAT_TTL_SECONDS = 45;

// TTL index: MongoDB's background task removes documents whose lastSeenAt
// has aged past the TTL, sweeping roughly every 60s. This is a backstop for
// viewers who vanish uncleanly (crash, network drop, sendBeacon failure on
// tab close) — it is NOT what the live count relies on, since the sweep
// isn't instant and can lag up to ~60s behind expiry. getViewerCount() in
// AuctionService filters by lastSeenAt directly for that reason; this index
// exists purely so the collection doesn't grow unbounded with dead rows.
auctionViewerSchema.index(
  { lastSeenAt: 1 },
  { expireAfterSeconds: VIEWER_HEARTBEAT_TTL_SECONDS }
);

export const AuctionViewer = mongoose.model('AuctionViewer', auctionViewerSchema);