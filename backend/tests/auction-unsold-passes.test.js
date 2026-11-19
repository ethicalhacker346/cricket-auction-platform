import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { seedAuction } from './fixtures/auction.js';
import { setupTestApp, teardownTestApp, request, authHeader } from './helpers.js';
import { Auction } from '../src/models/Auction.js';
import { AuctionRound, UNSOLD_PASS_INDEXES } from '../src/models/AuctionRound.js';
import { AuctionAction, AuctionActionChange } from '../src/models/AuctionAction.js';
import { TournamentPlayer } from '../src/models/TournamentPlayer.js';
import { TournamentTeam } from '../src/models/TournamentTeam.js';
import { Bid } from '../src/models/Bid.js';
import { AuctionService } from '../src/services/auction.service.js';
import { BidService } from '../src/services/bid.service.js';
import { AuctionCommandService } from '../src/services/auction-command.service.js';
import { migrateUnsoldPasses, assertUnsoldPassIndexes } from '../src/migrations/unsold-passes.js';
import eventBus from '../src/events/eventBus.js';
import { AUCTION_EVENTS } from '../src/events/auction.events.js';

let app;
let f;
const id = (value) => String(value?._id ?? value);
const root = () => `/api/v1/auctions/${f.auction._id}`;
const snapshot = () => AuctionService.getSnapshot(f.auction._id);
const start = () => AuctionService.start(f.auction._id, f.organizer);
const open = (index, round) => AuctionService.openLot(f.auction._id, f.organizer, { tournamentPlayerId: id(f.players[index]), roundId: id(round ?? f.rounds[0]) });
const settle = (sold = false, expected) => BidService.settleLot(f.auction._id, f.organizer, sold, expected);
const bid = (owner = f.owner1, amount = 100) => BidService.placeBid(f.auction._id, owner, { amount });
const retire = (index, expected) => AuctionService.markPermanentUnsold(f.auction._id, f.players[index]._id, f.organizer, expected);
const passes = () => AuctionRound.find({ auctionId: f.auction._id, type: 'unsold' }).sort({ unsoldPass: 1 });
const undo = async () => {
  const auction = await Auction.findById(f.auction._id).select('+undoHeadActionId');
  return AuctionCommandService.undo(f.auction._id, f.organizer, { actionId: id(auction.undoHeadActionId), reason: 'Pass correction' });
};
async function reset(options) {
  for (const Model of Object.values(mongoose.models)) await Model.deleteMany({});
  f = await seedAuction(options);
}
async function normalUnsold() {
  await start();
  for (let index = 0; index < f.players.length; index += 1) { await open(index); await settle(); }
  return (await passes())[0];
}
async function expectBalanced() {
  const teams = await TournamentTeam.find({ tournamentId: f.tournament._id });
  for (const team of teams) {
    const w = team.wallet;
    expect(w.remainingBudget + w.reservedBudget + w.spentBudget).toBe(w.initialBudget);
    expect(Math.min(w.remainingBudget, w.reservedBudget, w.spentBudget)).toBeGreaterThanOrEqual(0);
  }
  return teams;
}

beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(() => reset({ playerCount: 3 }));
afterEach(() => jest.restoreAllMocks());

test('three numbered unsold passes defer once per pass, exclude sold/retired players, and finish only at zero unresolved inventory', async () => {
  const first = await normalUnsold();
  expect(first).toMatchObject({ name: 'Unsold Round-1', unsoldPass: 1, order: 2 });
  await open(0, first); await settle();
  await expect(open(0, first)).rejects.toMatchObject({ statusCode: 409 });
  expect(await AuctionRound.countDocuments({ type: 'unsold' })).toBe(1);
  await open(1, first); await bid(); await settle(true);
  await retire(2);
  let rounds = await passes();
  expect(rounds).toHaveLength(2);
  expect(rounds[0].outcomeSummary.toObject()).toEqual({ sold: 1, unsold: 1, permanentUnsold: 1 });
  expect(rounds[1].playerIds.map(id)).toEqual([id(f.players[0])]);
  expect((await snapshot()).status).toBe('LIVE');
  await open(0, rounds[1]); await settle();
  rounds = await passes();
  expect(rounds.map((round) => round.name)).toEqual(['Unsold Round-1', 'Unsold Round-2', 'Unsold Round-3']);
  expect(rounds[1].outcomeSummary.unsold).toBe(1);
  await open(0, rounds[2]); await bid(f.owner2); await settle(true);
  const final = await snapshot();
  expect(final.status).toBe('COMPLETED');
  expect(await TournamentPlayer.countDocuments({ tournamentId: f.tournament._id, lotOutcome: { $in: ['NOT_LISTED', 'IN_PROGRESS', 'UNSOLD'] } })).toBe(0);
  expect(await AuctionRound.countDocuments({ type: 'unsold' })).toBe(3);
  expect((await AuctionRound.findById(f.rounds[0]._id)).outcomeSummary.unsold).toBe(3);
  expect(final.rounds.filter((round) => round.type === 'unsold').every((round) => round.status === 'COMPLETED')).toBe(true);
  expect((await expectBalanced()).map((team) => team.roster.length).sort()).toEqual([1, 1]);
});

test('no empty unsold pass is generated when the normal inventory sells', async () => {
  await reset({ playerCount: 1 }); await start(); await open(0); await bid(); await settle(true);
  expect(await AuctionRound.countDocuments({ type: 'unsold' })).toBe(0);
  expect((await snapshot()).status).toBe('COMPLETED');
});

test('normal rounds finish first; unused empty templates do not block the first unsold pass', async () => {
  await reset({ playerCount: 3, splitRounds: true });
  await AuctionService.addRound(f.auction._id, f.organizer, { name: 'Unused template', order: 3, playerIds: [] });
  await start(); await open(0); await settle(); await open(1); await settle();
  expect(await AuctionRound.countDocuments({ type: 'unsold' })).toBe(0);
  await open(2, f.rounds[1]); await settle();
  expect((await passes())[0]).toMatchObject({ unsoldPass: 1, order: 4 });
  const empty = await AuctionRound.findOne({ auctionId: f.auction._id, name: 'Unused template' });
  await expect(AuctionService.updateRound(f.auction._id, empty._id, f.organizer, { playerIds: [id(f.players[0])] })).rejects.toMatchObject({ statusCode: 409 });
});

test('the last repeated deferral races safely: one successor, one action, one publication', async () => {
  await reset({ playerCount: 1 }); const round = await normalUnsold(); await open(0, round); await bid();
  const before = await snapshot();
  const expected = { tournamentPlayerId: id(f.players[0]), roundId: id(round), expectedVersion: before.version };
  const added = jest.fn(); eventBus.on(AUCTION_EVENTS.ROUND_ADDED, added);
  try {
    const results = await Promise.allSettled([settle(false, expected), settle(false, expected)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await passes()).map((pass) => pass.unsoldPass)).toEqual([1, 2]);
    expect(await AuctionAction.countDocuments({ kind: 'LOT_UNSOLD' })).toBe(2); // normal + pass 1
    expect(added).toHaveBeenCalledTimes(1);
    expect(added.mock.calls[0][0].relistedPlayerIds.map(id)).toEqual([id(f.players[0])]);
    expect(added.mock.calls[0][0].version).toBeGreaterThan(before.version);
    expect((await expectBalanced()).every((team) => team.wallet.reservedBudget === 0)).toBe(true);
  } finally { eventBus.off(AUCTION_EVENTS.ROUND_ADDED, added); }
});

test('undoing pass 3 creation removes its successor and restores EVERY deferred player and historical counter', async () => {
  let round = await normalUnsold();
  for (let pass = 1; pass <= 2; pass += 1) {
    for (let index = 0; index < 3; index += 1) { await open(index, round); await settle(); }
    round = (await passes()).at(-1);
  }
  expect(round.unsoldPass).toBe(3);
  await undo();
  const rounds = await passes();
  expect(rounds.map((pass) => pass.unsoldPass)).toEqual([1, 2]);
  expect(rounds[1].status).toBe('ACTIVE'); expect(rounds[1].outcomeSummary).toBeUndefined();
  const players = await TournamentPlayer.find({ tournamentId: f.tournament._id }).sort({ _id: 1 });
  expect(players.map((player) => player.lotOutcome)).toEqual(['UNSOLD', 'UNSOLD', 'IN_PROGRESS']);
  expect(players.every((player) => id(player.auctionRoundId) === id(rounds[1]))).toBe(true);
  expect((await snapshot()).status).toBe('PAUSED');
  await undo(); // undo the final open as well: previous undo must not poison post-image checks
  expect((await TournamentPlayer.findById(f.players[2]._id)).lotOutcome).toBe('NOT_LISTED');
  expect((await AuctionRound.findById(rounds[0]._id)).outcomeSummary.unsold).toBe(3);
});

test('a journal failure rolls back round completion, all relists and successor creation without leaked events', async () => {
  await reset({ playerCount: 1 }); const round = await normalUnsold(); await open(0, round);
  const before = await snapshot(); const events = jest.fn();
  for (const event of [AUCTION_EVENTS.LOT_UNSOLD, AUCTION_EVENTS.ROUND_ADDED, AUCTION_EVENTS.ROUND_COMPLETED]) eventBus.on(event, events);
  try {
    jest.spyOn(AuctionActionChange, 'insertMany').mockRejectedValueOnce(new Error('Injected pass journal failure'));
    await expect(settle()).rejects.toThrow('Injected pass journal failure');
    expect(events).not.toHaveBeenCalled();
    expect((await passes())).toHaveLength(1);
    expect((await snapshot()).version).toBe(before.version);
    expect((await TournamentPlayer.findById(f.players[0]._id)).lotOutcome).toBe('IN_PROGRESS');
    expect((await AuctionRound.findById(round._id)).status).toBe('ACTIVE');
  } finally {
    for (const event of [AUCTION_EVENTS.LOT_UNSOLD, AUCTION_EVENTS.ROUND_ADDED, AUCTION_EVENTS.ROUND_COMPLETED]) eventBus.off(event, events);
  }
});

test('active Permanent Unsold releases the bid/clock atomically, and undo restores the exact reservation and player', async () => {
  await reset({ playerCount: 1 }); const round = await normalUnsold(); await open(0, round); const winning = await bid();
  const before = await snapshot();
  await request(app).post(`${root()}/players/${f.players[0]._id}/permanent-unsold`).set(authHeader(f.token(f.organizer)))
    .send({ roundId: id(round), expectedVersion: before.version }).expect(200);
  const final = await snapshot();
  expect(final.status).toBe('COMPLETED'); expect(final.currentPlayerId).toBeNull(); expect(final.timer.isRunning).toBe(false);
  const retired = await TournamentPlayer.findById(f.players[0]._id);
  expect(retired.lotOutcome).toBe('PERMANENT_UNSOLD'); expect(id(retired.permanentUnsoldBy)).toBe(id(f.organizer));
  expect((await Bid.findById(winning._id)).status).toBe('OUTBID');
  expect((await expectBalanced()).every((team) => team.wallet.reservedBudget === 0 && team.roster.length === 0)).toBe(true);
  await undo();
  const recovered = await snapshot();
  expect(recovered.status).toBe('PAUSED'); expect(recovered.currentBid.amount).toBe(100);
  expect((await Bid.findById(winning._id)).status).toBe('WINNING');
  expect((await TournamentPlayer.findById(f.players[0]._id)).permanentUnsoldAt).toBeUndefined();
  expect((await TournamentTeam.findById(f.teams[0]._id)).wallet.reservedBudget).toBe(100);
  expect((await AuctionRound.findById(round._id)).outcomeSummary).toBeUndefined();
  await expectBalanced();
});

test('pending retirement never stops/rewinds a different active player or consumes their reservation', async () => {
  const round = await normalUnsold(); await open(0, round); await bid();
  const before = await Auction.findById(f.auction._id); const emitted = jest.fn(); eventBus.on(AUCTION_EVENTS.LOT_PERMANENT_UNSOLD, emitted);
  try {
    await retire(1);
    const after = await Auction.findById(f.auction._id);
    expect(after.liveState.currentTournamentPlayerId).toEqual(before.liveState.currentTournamentPlayerId);
    expect(after.liveState.updatedAt).toEqual(before.liveState.updatedAt);
    expect(after.liveState.remainingTimeSeconds).toBe(before.liveState.remainingTimeSeconds);
    expect((await snapshot()).timer.isRunning).toBe(true);
    expect((await TournamentTeam.findById(f.teams[0]._id)).wallet.reservedBudget).toBe(100);
    expect(emitted.mock.calls[0][0].liveState).toBeUndefined();
  } finally { eventBus.off(AUCTION_EVENTS.LOT_PERMANENT_UNSOLD, emitted); }
});

test('retiring an active paused lot is supported without implicitly resuming the auction', async () => {
  const round = await normalUnsold(); await open(0, round); await bid();
  await AuctionService.pause(f.auction._id, f.organizer); await retire(0);
  expect((await snapshot()).status).toBe('PAUSED'); expect((await snapshot()).currentPlayerId).toBeNull();
  expect((await TournamentTeam.findById(f.teams[0]._id)).wallet.reservedBudget).toBe(0);
});

test('a reviewed permanent decision racing a new bid has one winner and never leaks or spends a reservation', async () => {
  await reset({ playerCount: 1 }); const round = await normalUnsold(); await open(0, round);
  const expected = { roundId: id(round), expectedVersion: (await snapshot()).version };
  const results = await Promise.allSettled([retire(0, expected), bid()]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const state = await snapshot(); const teams = await expectBalanced();
  expect(teams.reduce((sum, team) => sum + team.wallet.reservedBudget, 0)).toBe(state.currentBid.amount);
  expect(teams.every((team) => team.wallet.spentBudget === 0 && team.roster.length === 0)).toBe(true);
  expect(['LIVE', 'COMPLETED']).toContain(state.status);
});

test('stale player/pass/version decisions cannot settle a later lot, even when the same player returns', async () => {
  await reset({ playerCount: 1 }); await start(); await open(0);
  await expect(retire(0)).rejects.toMatchObject({ statusCode: 409 }); // not an unsold pass
  await settle(); const first = (await passes())[0]; await open(0, first);
  const reviewed = await snapshot(); await bid();
  await expect(settle(false, { tournamentPlayerId: id(f.players[0]), roundId: id(first), expectedVersion: reviewed.version })).rejects.toMatchObject({ statusCode: 409, code: 'STALE_LOT_DECISION' });
  await settle(); const second = (await passes())[1]; await open(0, second);
  for (const action of [() => retire(0, { roundId: id(first) }), () => settle(false, { roundId: id(first) })]) {
    await expect(action()).rejects.toMatchObject({ statusCode: 409, code: 'STALE_LOT_DECISION' });
  }
  expect((await snapshot()).lotStatus).toBe('BIDDING'); await expectBalanced();
});

test('new REST decisions require strict lot context and keep guests/unrelated accounts read-only', async () => {
  const round = await normalUnsold(); await open(0, round);
  const endpoints = [`${root()}/lot/unsold`, `${root()}/players/${f.players[0]._id}/permanent-unsold`, `${root()}/rounds/${round._id}/advance`];
  for (const endpoint of endpoints) {
    await request(app).post(endpoint).send({}).expect(401);
    for (const user of [f.owner1, f.otherOrganizer, f.playerUsers[0]]) await request(app).post(endpoint).set(authHeader(f.token(user))).send({}).expect(403);
  }
  const auth = authHeader(f.token(f.organizer));
  await request(app).post(endpoints[0]).set(auth).send({}).expect(400);
  await request(app).post(endpoints[1]).set(auth).send({ roundId: 'not-an-id' }).expect(400);
  await request(app).post(endpoints[0]).set(auth).send({ tournamentPlayerId: id(f.players[0]), roundId: id(round), unexpected: true }).expect(400);
  await request(app).post(endpoints[0]).set(auth).send({ tournamentPlayerId: id(f.players[0]), roundId: id(round), expectedVersion: (await snapshot()).version }).expect(200);
});

test('database constraints allow historical passes but reject two unfinished passes or reused pass numbers', async () => {
  const first = await normalUnsold();
  const shape = { auctionId: f.auction._id, type: 'unsold', name: 'Invalid extra pass', playerIds: [f.players[0]._id], order: 3 };
  await expect(AuctionRound.create({ ...shape, unsoldPass: 2 })).rejects.toMatchObject({ code: 11000 });
  await expect(AuctionRound.create({ ...shape, unsoldPass: 1, status: 'COMPLETED' })).rejects.toMatchObject({ code: 11000 });
  expect((await passes())).toHaveLength(1); expect(first.unsoldPass).toBe(1);
  await expect(AuctionService.addRound(f.auction._id, f.organizer, { name: 'Illegal normal round', order: 9, playerIds: [] })).rejects.toMatchObject({ statusCode: 409 });
});

test('an already-exhausted legacy unsold pass can continue explicitly, with rollback/undo and no endless same-pass loop', async () => {
  await reset({ playerCount: 1 }); const first = await normalUnsold();
  // Before this upgrade UNSOLD was not terminal for a pass, so persisted rooms
  // can already be sitting idle in this exact state.
  await AuctionRound.updateOne({ _id: first._id }, { $set: { status: 'ACTIVE', startedAt: new Date() } });
  await TournamentPlayer.updateOne({ _id: f.players[0]._id }, { $set: { lotOutcome: 'UNSOLD' } });
  const version = (await snapshot()).version;
  const added = jest.fn(); eventBus.once(AUCTION_EVENTS.ROUND_ADDED, added);
  await request(app).post(`${root()}/rounds/${first._id}/advance`).set(authHeader(f.token(f.organizer))).send({ expectedVersion: version }).expect(200);
  expect((await passes()).map((pass) => pass.unsoldPass)).toEqual([1, 2]);
  expect(added).toHaveBeenCalledTimes(1);
  expect(added.mock.calls[0][0].version).toBe((await snapshot()).version);
  expect(added.mock.calls[0][0].liveState.version).toBe((await snapshot()).version);
  expect((await TournamentPlayer.findById(f.players[0]._id)).lotOutcome).toBe('NOT_LISTED');
  await expect(AuctionService.advanceUnsoldPass(f.auction._id, first._id, f.organizer)).rejects.toMatchObject({ statusCode: 409 });
  await undo();
  expect((await passes())).toHaveLength(1); expect((await TournamentPlayer.findById(f.players[0]._id)).lotOutcome).toBe('UNSOLD');
  expect((await AuctionRound.findById(first._id)).outcomeSummary).toBeUndefined();
});

test('migration is dry-run-first, metadata-only and idempotent, retaining custom indexes and enabling a second pass', async () => {
  await reset({ playerCount: 1 }); const first = await normalUnsold();
  const collection = AuctionRound.collection;
  for (const [, options] of UNSOLD_PASS_INDEXES) await collection.dropIndex(options.name);
  await collection.createIndex({ auctionId: 1, type: 1 }, { name: 'auctionId_1_type_1', unique: true, partialFilterExpression: { type: 'unsold' } });
  await collection.createIndex({ completedAt: 1 }, { name: 'custom_operator_index' });
  await collection.createIndex({ auctionId: 1, type: 1 }, { name: 'custom_unique_unsold_filter', unique: true, partialFilterExpression: { type: 'unsold', category: 'CUSTOM_RESTRICTED' } });
  await collection.updateOne({ _id: first._id }, { $unset: { unsoldPass: '' } });
  const before = await collection.findOne({ _id: first._id });
  const actions = await AuctionAction.countDocuments();
  try {
    await expect(assertUnsoldPassIndexes(mongoose.connection.db)).rejects.toThrow('indexes are not ready');
    expect(await migrateUnsoldPasses(mongoose.connection.db)).toMatchObject({ mode: 'dry-run', passNumbersToBackfill: 1, legacyIndexesToRemove: ['auctionId_1_type_1'] });
    expect((await collection.findOne({ _id: first._id })).unsoldPass).toBeUndefined();
    await migrateUnsoldPasses(mongoose.connection.db, { apply: true });
    await assertUnsoldPassIndexes(mongoose.connection.db);
    const { unsoldPass, ...after } = await collection.findOne({ _id: first._id });
    expect(unsoldPass).toBe(1); expect(after).toEqual(before);
    expect(await AuctionAction.countDocuments()).toBe(actions);
    expect((await collection.indexes()).some((index) => index.name === 'custom_operator_index')).toBe(true);
    expect((await collection.indexes()).some((index) => index.name === 'custom_unique_unsold_filter')).toBe(true);
    expect(await migrateUnsoldPasses(mongoose.connection.db, { apply: true })).toMatchObject({ passNumbersToBackfill: 0, legacyIndexesToRemove: [] });
    await open(0, first); await settle(); expect((await passes()).map((pass) => pass.unsoldPass)).toEqual([1, 2]);
  } finally {
    // Restore the model's constraints even if an assertion fails mid-migration.
    await migrateUnsoldPasses(mongoose.connection.db, { apply: true });
  }
});

test.each([
  ['two unfinished passes', [{ status: 'ACTIVE' }, { status: 'PENDING' }], /Multiple unfinished/],
  ['duplicate pass numbers', [{ status: 'COMPLETED', unsoldPass: 1 }, { status: 'COMPLETED', unsoldPass: 1 }], /Invalid\/duplicate/],
  ['an invalid pass number', [{ status: 'COMPLETED', unsoldPass: 0 }], /Invalid\/duplicate/],
])('migration preflight rejects %s without partially backfilling another auction', async (_name, bad, message) => {
  // Separate disposable test database: no application or financial collections.
  const db = mongoose.connection.getClient().db('unsold_pass_migration_preflight');
  const collection = db.collection('auctionrounds');
  const validAuction = new mongoose.Types.ObjectId(); const invalidAuction = new mongoose.Types.ObjectId();
  try {
    await collection.insertMany([
      { auctionId: validAuction, type: 'unsold', order: 2, status: 'COMPLETED' },
      ...bad.map((data, index) => ({ auctionId: invalidAuction, type: 'unsold', order: index + 1, ...data })),
    ]);
    const before = await collection.find().sort({ _id: 1 }).toArray();
    const indexes = await collection.indexes();
    await expect(migrateUnsoldPasses(db)).rejects.toThrow(message);
    await expect(migrateUnsoldPasses(db, { apply: true })).rejects.toThrow(message);
    expect(await collection.find().sort({ _id: 1 }).toArray()).toEqual(before);
    expect(await collection.indexes()).toEqual(indexes);
  } finally { await collection.drop(); }
});

test('migration never drops a conflicting replacement-index name or writes metadata before flagging it', async () => {
  const db = mongoose.connection.getClient().db('unsold_pass_migration_preflight');
  const collection = db.collection('auctionrounds');
  try {
    await collection.insertOne({ auctionId: f.auction._id, type: 'unsold', status: 'COMPLETED', order: 2 });
    await collection.createIndex({ order: 1 }, { name: 'unique_unsold_pass_number' });
    await expect(migrateUnsoldPasses(db, { apply: true })).rejects.toThrow('unexpected definition');
    expect((await collection.findOne()).unsoldPass).toBeUndefined();
    expect((await collection.indexes()).find((index) => index.name === 'unique_unsold_pass_number').key).toEqual({ order: 1 });
  } finally { await collection.drop(); }
});
