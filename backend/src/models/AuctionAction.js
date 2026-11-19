import mongoose from 'mongoose';

// One small header per command; pre-images live in separate documents so a
// round-completion cascade cannot grow the auction (or a header) past 16 MB.
const actionSchema = new mongoose.Schema({
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  previousActionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AuctionAction', default: null },
  kind: { type: String, required: true },
  commandId: { type: String, maxlength: 150 },
  commandFingerprint: { type: String, maxlength: 255 },
  label: { type: String, required: true, maxlength: 500 },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['APPLIED', 'UNDONE'], default: 'APPLIED', required: true },
  version: { type: Number, required: true },
  undoneAt: Date,
  undoneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  undoReason: { type: String, maxlength: 500 },
}, { timestamps: true });
actionSchema.index({ auctionId: 1, createdAt: -1, _id: -1 });
actionSchema.index({ auctionId: 1, commandId: 1 }, { unique: true, partialFilterExpression: { commandId: { $type: 'string' } } });

const changeSchema = new mongoose.Schema({
  actionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AuctionAction', required: true },
  model: { type: String, enum: ['Auction', 'Tournament', 'AuctionRound', 'TournamentPlayer', 'TournamentTeam', 'Bid'], required: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  fields: [String],
  restoreFields: [String],
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
}, { minimize: false });
changeSchema.index({ actionId: 1, model: 1, documentId: 1 }, { unique: true });

export const AuctionAction = mongoose.model('AuctionAction', actionSchema);
export const AuctionActionChange = mongoose.model('AuctionActionChange', changeSchema);
