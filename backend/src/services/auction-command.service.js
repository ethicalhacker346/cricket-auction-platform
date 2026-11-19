import mongoose from 'mongoose';
import { isDeepStrictEqual } from 'node:util';
import { Auction } from '../models/Auction.js';
import { AuctionAction, AuctionActionChange } from '../models/AuctionAction.js';
import { AuctionAuthorizationService } from './auction-authorization.service.js';
import { AUCTION_PERMISSIONS } from './permission.engine.js';
import { AppError, assertFound } from '../utils/helpers.js';
import { emitActionRecorded, emitActionUndone, withAuctionEventVersion } from '../events/auction.events.js';

const AUCTION_FIELDS = [
  'name', 'status', 'auctionConfiguration', 'bidIncrementTiers',
  'lotTimerSeconds', 'bidResetSeconds', 'scheduledAt', 'startedAt', 'completedAt', 'liveState',
];
const SCOPES = Object.freeze({
  Auction: AUCTION_FIELDS,
  Tournament: ['status'],
  AuctionRound: ['auctionId', 'name', 'order', 'type', 'category', 'playerIds', 'status', 'startedAt', 'completedAt', 'createdAt'],
  TournamentPlayer: ['lotOutcome', 'auctionRoundId', 'isSold', 'soldToTeamId', 'soldPrice', 'soldAt', 'permanentUnsoldAt', 'permanentUnsoldBy'],
  TournamentTeam: ['wallet', 'roster'],
  Bid: ['auctionId', 'roundId', 'tournamentTeamId', 'tournamentPlayerId', 'amount', 'status', 'placedAt', 'createdAt'],
});
const GUARDS = Object.freeze({
  TournamentPlayer: ['tournamentId', 'playerId', 'status', 'basePrice', 'primaryRole'],
  TournamentTeam: ['tournamentId', 'ownerId', 'status'],
});

const plain = (doc) => doc?.toObject
  ? doc.toObject({ depopulate: true, virtuals: false, transform: false })
  : doc;
const pick = (doc, fields) => Object.fromEntries(fields
  .filter((field) => doc[field] !== undefined)
  .map((field) => [field, doc[field]]));

// Wall-clock drift, monotonic revisions, and the recovery pause are not
// conflicting business changes. Everything else must still match the post-image.
export function comparableActionValue(model, field, value) {
  if (model === 'Auction' && field === 'status' && ['LIVE', 'PAUSED'].includes(value)) return 'RUNNING';
  if (model === 'Auction' && field === 'liveState' && value) {
    const { version, updatedAt, remainingTimeSeconds, ...domain } = value;
    return domain;
  }
  return value;
}

export function actionSummary(action) {
  if (!action) return null;
  return {
    id: String(action._id), kind: action.kind, label: action.label,
    createdAt: action.createdAt, version: action.version,
  };
}

/** Field-scoped, transaction-local journal. Never captures user/profile data. */
export class AuctionJournal {
  constructor(session, auctionStatus) {
    this.session = session;
    this.auctionStatus = auctionStatus;
    this.entries = new Map();
  }

  track(doc, fields = SCOPES[doc.constructor.modelName]) {
    const model = doc.constructor.modelName;
    const key = `${model}:${doc._id}`;
    const existing = this.entries.get(key);
    if (existing) return doc;
    const raw = plain(doc);
    const allFields = [...new Set([...fields, ...(GUARDS[model] || [])])];
    const before = pick(raw, allFields);
    if (model === 'Auction' && before.liveState && this.auctionStatus === 'LIVE' && before.liveState.lotStatus === 'BIDDING') {
      const elapsed = Math.max(0, (Date.now() - new Date(before.liveState.updatedAt).getTime()) / 1000);
      before.liveState.remainingTimeSeconds = Math.max(0, (before.liveState.remainingTimeSeconds ?? 0) - elapsed);
    }
    this.entries.set(key, { model, documentId: doc._id, fields: allFields, mutable: fields, before });
    return doc;
  }

  created(doc) {
    const model = doc.constructor.modelName;
    this.entries.set(`${model}:${doc._id}`, {
      model, documentId: doc._id, fields: SCOPES[model], mutable: SCOPES[model], before: null,
    });
    return doc;
  }

  async persist(actionId) {
    const changes = [];
    // Sequential reads: parallel operations on a MongoDB session are unsupported.
    for (const entry of this.entries.values()) {
      const doc = await mongoose.model(entry.model).findById(entry.documentId).session(this.session).lean();
      const after = doc ? pick(doc, entry.fields) : null;
      const restoreFields = entry.mutable.filter((field) => !isDeepStrictEqual(entry.before?.[field], after?.[field]));
      // Guard-only entries are intentional: e.g. changing approval/base-price
      // outside the engine makes restoring an old reservation unsafe.
      changes.push({ actionId, ...entry, after, restoreFields });
    }
    if (changes.length) await AuctionActionChange.insertMany(changes, { session: this.session });
  }
}

const conflict = (message, code = 'AUCTION_ACTION_CONFLICT') => {
  const error = new AppError(message, 409);
  error.code = code;
  return error;
};

function rethrowCommandError(error) {
  if (error.name === 'VersionError' || error.code === 112) {
    throw conflict('Auction changed while processing this action. Refresh and try again.');
  }
  throw error;
}

async function publish(outbox) {
  for (const emit of outbox) {
    try { await emit(); }
    catch (error) { console.error('[AuctionCommand] post-commit side effect failed', error); }
  }
}

/**
 * The Auction document is the serialization fence for EVERY auction command.
 * Transaction retries rebuild authorization, pre-images and the outbox; no
 * notification or socket emission can escape an aborted/retried transaction.
 */
export class AuctionCommandService {
  static async run({ auctionId, user, permission, kind, label, commandId, commandFingerprint }, work) {
    const session = await mongoose.startSession();
    let committed;
    try {
      await session.withTransaction(async () => {
        const context = await AuctionAuthorizationService.buildContext({ auctionId, user, session });
        context.require(permission);
        const tournament = context.tournament;
        const auction = context.auction;
        auction.depopulate('tournamentId');
        if (commandId) {
          const existing = await AuctionAction.findOne({ auctionId, commandId }).session(session);
          if (existing) {
            if (existing.status !== 'APPLIED' || existing.kind !== kind || String(existing.actorId) !== String(user._id) || existing.commandFingerprint !== commandFingerprint) {
              throw conflict('This command was already used or undone. Review the current lot before trying again.', 'COMMAND_ALREADY_USED');
            }
            committed = { result: null, auction, action: actionSummary(existing), outbox: [] };
            return;
          }
        }
        const previousVersion = auction.liveState?.version ?? 0;
        const journal = new AuctionJournal(session, auction.status);
        journal.track(auction);
        journal.track(tournament);
        auction.liveState.version = previousVersion + 1;
        const outbox = [];
        const afterCommit = [];
        const scope = { auction, tournament, context, journal, outbox, afterCommit, session };
        const result = await work(scope);
        // Helpers may have saved a separate instance during a completion cascade.
        const finalAuction = await Auction.findById(auctionId).select('+undoHeadActionId').session(session);
        finalAuction.liveState.version = previousVersion + 1;
        const action = new AuctionAction({
          auctionId, previousActionId: auction.undoHeadActionId ?? null,
          kind, label: scope.label || label, actorId: user._id, version: previousVersion + 1,
          ...(commandId ? { commandId, commandFingerprint } : {}),
        });
        finalAuction.undoHeadActionId = action._id;
        await finalAuction.save({ session });
        await action.save({ session });
        await journal.persist(action._id);
        const summary = actionSummary(action);
        outbox.push(() => emitActionRecorded(auctionId, {
          action: summary, version: finalAuction.liveState.version,
          liveState: finalAuction.liveState, status: finalAuction.status,
          lotTimerSeconds: finalAuction.lotTimerSeconds,
        }));
        // Realtime/audit metadata never waits behind email/notification I/O.
        committed = { result, auction: finalAuction, action: summary, outbox: [...outbox, ...afterCommit] };
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    } catch (error) { rethrowCommandError(error); }
    finally { await session.endSession(); }
    await withAuctionEventVersion(auctionId, committed.auction.liveState.version, () => publish(committed.outbox));
    return committed;
  }

  static async latest(auction, session = null) {
    // Callers that don't select the private head can resolve it explicitly.
    const head = auction.undoHeadActionId === undefined
      ? (await Auction.findById(auction._id).select('+undoHeadActionId').session(session).lean())?.undoHeadActionId
      : auction.undoHeadActionId;
    return head ? actionSummary(await AuctionAction.findOne({ _id: head, auctionId: auction._id, status: 'APPLIED' }).session(session).lean()) : null;
  }

  static async history(auctionId, user) {
    await AuctionAuthorizationService.assertPermission({ auctionId, user, permission: AUCTION_PERMISSIONS.UNDO_ACTION });
    const rows = await AuctionAction.find({ auctionId }).sort({ createdAt: -1, _id: -1 }).limit(30)
      .select('kind label actorId status createdAt version undoneAt undoneBy undoReason');
    return rows;
  }

  static async undo(auctionId, user, { actionId, reason = '' }) {
    const session = await mongoose.startSession();
    let committed;
    try {
      await session.withTransaction(async () => {
        const context = await AuctionAuthorizationService.buildContext({ auctionId, user, session });
        context.require(AUCTION_PERMISSIONS.UNDO_ACTION);
        const auction = context.auction;
        auction.depopulate('tournamentId');
        if (!auction.undoHeadActionId || String(auction.undoHeadActionId) !== String(actionId)) {
          throw conflict('The latest action has changed. Review it before confirming undo again.', 'STALE_AUCTION_ACTION');
        }
        const action = assertFound(await AuctionAction.findOne({ _id: actionId, auctionId, status: 'APPLIED' }).session(session), 'Action not found');
        const changes = await AuctionActionChange.find({ actionId }).sort({ _id: -1 }).session(session).lean();
        const version = (auction.liveState?.version ?? 0) + 1;
        const loaded = [];
        // Validate ALL post-images before applying ANY compensation.
        for (const change of changes) {
          const Model = mongoose.model(change.model);
          const doc = change.model === 'Auction' ? auction : await Model.findById(change.documentId).session(session);
          const raw = doc ? plain(doc) : null;
          if (Boolean(raw) !== Boolean(change.after)) throw conflict('A related resource changed outside the auction. Undo is blocked to protect its data.');
          if (raw) {
            for (const field of change.fields) {
              if (!isDeepStrictEqual(
                comparableActionValue(change.model, field, raw[field]),
                comparableActionValue(change.model, field, change.after[field]),
              )) throw conflict('A related resource changed outside the auction. Undo is blocked to protect its data.');
            }
          }
          loaded.push({ change, Model, doc });
        }
        for (const { change, Model, doc } of loaded) {
          if (!change.before) {
            if (change.model === 'Bid') {
              // Financial history is never erased. Cancelled bids stay visible
              // in history but cannot become the leader again by query accident.
              doc.status = 'CANCELLED';
              doc.cancelledAt = new Date();
              doc.cancelledBy = user._id;
              await doc.save({ session });
            } else {
              await Model.deleteOne({ _id: change.documentId }, { session });
            }
          } else if (!doc) {
            await Model.create([{ _id: change.documentId, ...change.before }], { session });
          } else {
            for (const field of change.restoreFields) doc.set(field, change.before[field]);
            if (change.model !== 'Auction') await doc.save({ session });
          }
        }
        // A restored bidding lot is ALWAYS paused, with a fresh review window.
        // Undo pause/resume itself still restores the requested lifecycle state.
        if (auction.liveState?.lotStatus === 'BIDDING' && !['AUCTION_PAUSED', 'AUCTION_RESUMED'].includes(action.kind)) {
          auction.status = 'PAUSED';
          auction.liveState.remainingTimeSeconds = Math.max(auction.liveState.remainingTimeSeconds ?? 0, auction.bidResetSeconds);
        }
        auction.lastUndoVersion = version;
        auction.liveState.version = version; // never rewind a transport revision
        auction.liveState.updatedAt = new Date();
        auction.undoHeadActionId = action.previousActionId ?? null;
        auction.logs.push({
          action: 'ACTION_UNDONE', userId: user._id,
          message: `Undid: ${action.label}`,
          metadata: { actionId: action._id, kind: action.kind, reason },
        });
        await auction.save({ session });
        action.status = 'UNDONE';
        action.undoneAt = new Date();
        action.undoneBy = user._id;
        action.undoReason = reason;
        await action.save({ session });
        const nextAction = action.previousActionId
          ? await AuctionAction.findById(action.previousActionId).session(session).lean() : null;
        committed = { auction, liveState: auction.liveState, undoneAction: actionSummary(action), nextAction: actionSummary(nextAction), version };
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    } catch (error) { rethrowCommandError(error); }
    finally { await session.endSession(); }
    emitActionUndone(auctionId, {
      auction: committed.auction,
      liveState: committed.auction.liveState,
      undoneAction: committed.undoneAction, action: committed.nextAction, version: committed.version,
    });
    return committed;
  }
}
