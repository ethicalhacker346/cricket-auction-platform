import { isDeepStrictEqual } from 'node:util';
import { UNSOLD_PASS_INDEXES } from '../models/AuctionRound.js';

const legacy = (index) => index.unique && isDeepStrictEqual(index.key, { auctionId: 1, type: 1 })
  && isDeepStrictEqual(index.partialFilterExpression, { type: 'unsold' });

async function indexesOf(collection) {
  try { return await collection.indexes(); }
  catch (error) { if (error.code === 26) return []; throw error; }
}

/** Metadata/index-only migration. Run with auction writers STOPPED and a backup. */
export async function migrateUnsoldPasses(db, { apply = false } = {}) {
  const collection = db.collection('auctionrounds');
  const indexes = await indexesOf(collection);
  const old = indexes.filter(legacy);
  // A conflicting operator-created name needs deliberate reconciliation, not
  // an implicit drop (or metadata writes followed by an opaque index error).
  for (const [keys, options] of UNSOLD_PASS_INDEXES) {
    const named = indexes.find((index) => index.name === options.name);
    if (named && (!isDeepStrictEqual(named.key, keys) || named.unique !== true
      || !isDeepStrictEqual(named.partialFilterExpression, options.partialFilterExpression))) {
      throw new Error(`Index ${options.name} has an unexpected definition. Reconcile it before migration; no indexes were dropped.`);
    }
  }
  const updates = [];
  let group = [];
  let auctionId;
  let roundsChecked = 0;
  const planGroup = () => {
    const used = new Set();
    if (group.filter((round) => ['PENDING', 'ACTIVE'].includes(round.status)).length > 1) {
      throw new Error('Multiple unfinished unsold passes exist in one auction. Reconcile them before migration.');
    }
    for (const round of group) {
      if (round.unsoldPass === undefined) continue;
      if (!Number.isSafeInteger(round.unsoldPass) || round.unsoldPass < 1 || used.has(round.unsoldPass)) {
        throw new Error('Invalid/duplicate unsold pass numbers exist. Reconcile them before migration.');
      }
      used.add(round.unsoldPass);
    }
    let number = 1;
    for (const round of group) {
      if (round.unsoldPass !== undefined) continue;
      while (used.has(number)) number += 1;
      used.add(number);
      updates.push({ updateOne: { filter: { _id: round._id, unsoldPass: { $exists: false } }, update: { $set: { unsoldPass: number } } } });
    }
  };
  // Stream sorted small metadata, not player arrays or financial documents.
  for await (const round of collection.find({ type: 'unsold' }, { projection: { auctionId: 1, order: 1, status: 1, unsoldPass: 1 } }).sort({ auctionId: 1, order: 1, _id: 1 })) {
    if (auctionId !== String(round.auctionId)) { planGroup(); group = []; auctionId = String(round.auctionId); }
    group.push(round); roundsChecked += 1;
  }
  planGroup();
  if (apply) {
    for (let offset = 0; offset < updates.length; offset += 500) await collection.bulkWrite(updates.slice(offset, offset + 500), { ordered: true });
    // Install both replacement constraints BEFORE removing the old one. Never
    // syncIndexes/dropIndexes: unrelated/custom indexes must remain untouched.
    for (const [keys, options] of UNSOLD_PASS_INDEXES) await collection.createIndex(keys, options);
    for (const index of old) await collection.dropIndex(index.name);
  }
  return {
    mode: apply ? 'applied' : 'dry-run', roundsChecked, passNumbersToBackfill: updates.length,
    legacyIndexesToRemove: old.map((index) => index.name),
    requiredIndexes: UNSOLD_PASS_INDEXES.map(([, options]) => options.name),
  };
}

/** Fail production startup clearly rather than fail the final lot mid-event. */
export async function assertUnsoldPassIndexes(db) {
  const indexes = await indexesOf(db.collection('auctionrounds'));
  const ready = !indexes.some(legacy) && UNSOLD_PASS_INDEXES.every(([keys, options]) => indexes.some((index) =>
    isDeepStrictEqual(index.key, keys) && index.unique === true
    && isDeepStrictEqual(index.partialFilterExpression, options.partialFilterExpression)));
  if (!ready) throw new Error('Unsold-pass indexes are not ready. Stop auction writers and run node scripts/migrate-unsold-passes.mjs --apply from backend before starting production.');
}
