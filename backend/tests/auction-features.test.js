import { seedAuction as seed } from './fixtures/auction.js';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { setupTestApp, teardownTestApp, request, authHeader } from './helpers.js';
import { Player } from '../src/models/Player.js';
import { Tournament } from '../src/models/Tournament.js';
import { TournamentPlayer } from '../src/models/TournamentPlayer.js';
import { TournamentTeam } from '../src/models/TournamentTeam.js';
import { Auction } from '../src/models/Auction.js';
import { AuctionRound } from '../src/models/AuctionRound.js';
import { AuctionAction, AuctionActionChange } from '../src/models/AuctionAction.js';
import { Bid } from '../src/models/Bid.js';
import { AuctionService } from '../src/services/auction.service.js';
import { BidService } from '../src/services/bid.service.js';
import { AuctionCommandService } from '../src/services/auction-command.service.js';
import eventBus from '../src/events/eventBus.js';
import { AUCTION_EVENTS } from '../src/events/auction.events.js';
import { normalizeCricHeroesUrl } from '../src/utils/cricheroes.js';

let app;
let fixture;
const id = (value) => String(value._id ?? value);


const start = () => AuctionService.start(fixture.auction._id, fixture.organizer);
const open = (index = 0, round = fixture.rounds[0]) => AuctionService.openLot(fixture.auction._id, fixture.organizer, { tournamentPlayerId: fixture.players[index]._id, roundId: round._id });
const bid = (owner, amount) => BidService.placeBid(fixture.auction._id, owner, { amount });
const settle = (sold = true) => BidService.settleLot(fixture.auction._id, fixture.organizer, sold);
const head = async () => (await Auction.findById(fixture.auction._id).select('+undoHeadActionId')).undoHeadActionId;
const undo = async (actionId) => AuctionCommandService.undo(fixture.auction._id, fixture.organizer, { actionId: id(actionId ?? await head()), reason: 'Correction in integration test' });
const state = () => AuctionService.getSnapshot(fixture.auction._id);
const wallets = async () => (await TournamentTeam.find({ tournamentId: fixture.tournament._id }).sort({ name: 1 })).map((team) => team.wallet.toObject());
const expectBalanced = (rows) => rows.forEach((wallet) => expect(wallet.remainingBudget + wallet.reservedBudget + wallet.spentBudget).toBe(wallet.initialBudget));

beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(async () => {
  for (const Model of Object.values(mongoose.models)) await Model.deleteMany({});
  fixture = await seed();
});
afterEach(() => jest.restoreAllMocks());

describe('organizer transactional undo', () => {
  test('undoes consecutive bids, cancels rather than deletes them, and restores the previous reservation', async () => {
    await start(); await open();
    const first = await bid(fixture.owner1, 100);
    const second = await bid(fixture.owner2, 110);
    const version = (await state()).version;
    await undo();
    let snapshot = await state();
    expect(snapshot.status).toBe('PAUSED');
    expect(snapshot.currentBid.amount).toBe(100);
    expect(id(snapshot.currentBid.teamId)).toBe(id(fixture.teams[0]));
    expect(snapshot.version).toBeGreaterThan(version);
    expect(snapshot.lastUndoVersion).toBe(snapshot.version);
    expect(snapshot.timer.isRunning).toBe(false);
    expect((await Bid.findById(second._id)).status).toBe('CANCELLED');
    expect((await Bid.findById(first._id)).status).toBe('WINNING');
    let rows = await wallets();
    expect(rows.map((wallet) => wallet.reservedBudget)).toEqual([100, 0]);
    expectBalanced(rows);
    await undo();
    snapshot = await state();
    expect(snapshot.currentBid).toEqual({ amount: 0, teamId: null });
    rows = await wallets();
    expect(rows.map((wallet) => wallet.remainingBudget)).toEqual([1000, 1000]);
    expectBalanced(rows);
    expect(await Bid.countDocuments({ status: 'CANCELLED' })).toBe(2);
    expect(await AuctionAction.countDocuments({ status: 'UNDONE' })).toBe(2);
    expect((await AuctionCommandService.history(fixture.auction._id, fixture.organizer)).find((action) => action.status === 'UNDONE').undoReason).toContain('Correction');
  });

  test('reverses a sold decision, restoring roster, purse, player and winning bid as a paused lot', async () => {
    await start(); await open(); await bid(fixture.owner1, 100); await settle();
    expect((await TournamentTeam.findById(fixture.teams[0]._id)).roster).toHaveLength(1);
    await undo();
    const snapshot = await state();
    const player = await TournamentPlayer.findById(fixture.players[0]._id);
    expect(snapshot.status).toBe('PAUSED'); expect(snapshot.lotStatus).toBe('BIDDING');
    expect(snapshot.currentBid.amount).toBe(100); expect(id(snapshot.currentPlayerId)).toBe(id(player));
    expect(player.lotOutcome).toBe('IN_PROGRESS'); expect(player.isSold).toBe(false);
    expect(player.soldAt).toBeUndefined(); expect(player.soldPrice).toBeUndefined(); expect(player.soldToTeamId).toBeUndefined();
    const team = await TournamentTeam.findById(fixture.teams[0]._id);
    expect(team.roster).toHaveLength(0); expect(team.wallet.spentBudget).toBe(0); expect(team.wallet.reservedBudget).toBe(100);
    expectBalanced(await wallets());
    await expect(bid(fixture.owner2, 110)).rejects.toMatchObject({ statusCode: 403 });
    await AuctionService.resume(fixture.auction._id, fixture.organizer);
    await bid(fixture.owner2, 110);
    expect((await state()).currentBid.amount).toBe(110);
  });

  test('undoes an unsold decision with a winning reservation and restores bid status', async () => {
    await start(); await open(); const winning = await bid(fixture.owner1, 100); await settle(false);
    expect((await Bid.findById(winning._id)).status).toBe('OUTBID');
    await undo();
    expect((await Bid.findById(winning._id)).status).toBe('WINNING');
    expect((await state()).currentBid.amount).toBe(100);
    expect((await wallets())[0].reservedBudget).toBe(100);
  });

  test('reverses final sale AND automatic round/auction/tournament completion', async () => {
    await mongoose.connection.dropDatabase(); await Promise.all(Object.values(mongoose.models).map((Model) => Model.createIndexes()));
    fixture = await seed({ playerCount: 1 });
    await start(); await open(); await bid(fixture.owner1, 100); await settle();
    expect((await state()).status).toBe('COMPLETED');
    expect((await Tournament.findById(fixture.tournament._id)).status).toBe('AUCTION_COMPLETED');
    await undo();
    expect((await state()).status).toBe('PAUSED');
    expect((await AuctionRound.findById(fixture.rounds[0]._id)).status).toBe('ACTIVE');
    expect((await Tournament.findById(fixture.tournament._id)).status).toBe('AUCTION_RUNNING');
    expect((await Auction.findById(fixture.auction._id)).completedAt).toBeUndefined();
    expectBalanced(await wallets());
  });

  test('undoes unsold-round creation and restores ALL reset players, not just the last lot', async () => {
    await start();
    for (let index = 0; index < 3; index += 1) { await open(index); await settle(false); }
    expect(await AuctionRound.countDocuments({ type: 'unsold' })).toBe(1);
    expect(await TournamentPlayer.countDocuments({ lotOutcome: 'NOT_LISTED' })).toBe(3);
    await undo();
    expect(await AuctionRound.countDocuments({ type: 'unsold' })).toBe(0);
    const players = await TournamentPlayer.find({ tournamentId: fixture.tournament._id }).sort({ _id: 1 });
    expect(players.map((player) => player.lotOutcome)).toEqual(['UNSOLD', 'UNSOLD', 'IN_PROGRESS']);
    expect(players.every((player) => id(player.auctionRoundId) === id(fixture.rounds[0]))).toBe(true);
    expect((await state()).status).toBe('PAUSED');
  });

  test('permanent-unsold and its completion cascade are undoable atomically', async () => {
    await mongoose.connection.dropDatabase(); await Promise.all(Object.values(mongoose.models).map((Model) => Model.createIndexes()));
    fixture = await seed({ playerCount: 1 });
    await start(); await open(); await settle(false);
    const round = await AuctionRound.findOne({ type: 'unsold' });
    await AuctionService.markPermanentUnsold(fixture.auction._id, fixture.players[0]._id, fixture.organizer);
    expect((await state()).status).toBe('COMPLETED');
    await undo();
    const player = await TournamentPlayer.findById(fixture.players[0]._id);
    expect(player.lotOutcome).toBe('NOT_LISTED'); expect(player.permanentUnsoldBy).toBeUndefined(); expect(player.permanentUnsoldAt).toBeUndefined();
    expect((await AuctionRound.findById(round._id)).status).toBe('PENDING');
    expect((await Tournament.findById(fixture.tournament._id)).status).toBe('AUCTION_RUNNING');
  });

  test('supports open/start/pause/resume, rule changes and round add/update/delete', async () => {
    await AuctionService.updateRules(fixture.auction._id, fixture.organizer, { name: 'Changed', lotTimerSeconds: 90 });
    await undo(); expect((await state()).auction.name).toBe('Test Auction');
    const round = await AuctionService.addRound(fixture.auction._id, fixture.organizer, { name: 'New', order: 2, playerIds: [] });
    await AuctionService.updateRound(fixture.auction._id, round._id, fixture.organizer, { name: 'Renamed' });
    await undo(); expect((await AuctionRound.findById(round._id)).name).toBe('New');
    await AuctionService.deleteRound(fixture.auction._id, round._id, fixture.organizer);
    await undo(); expect((await AuctionRound.findById(round._id)).name).toBe('New');
    await undo(); expect(await AuctionRound.findById(round._id)).toBeNull();
    await start(); await open(2);
    await AuctionService.pause(fixture.auction._id, fixture.organizer);
    const frozen = (await state()).timer.remaining;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await state()).timer.remaining).toBe(frozen);
    await AuctionService.resume(fixture.auction._id, fixture.organizer);
    await undo(); expect((await state()).status).toBe('PAUSED');
    await undo(); expect((await state()).status).toBe('LIVE');
    await undo(); expect((await state()).currentPlayerId).toBeNull();
    expect((await TournamentPlayer.findById(fixture.players[2]._id)).lotOutcome).toBe('NOT_LISTED');
    await undo(); expect((await state()).status).toBe('DRAFT');
    expect((await Tournament.findById(fixture.tournament._id)).status).toBe('AUCTION_SCHEDULED');
  });

  test('rejects stale and repeated confirmations without touching the latest action', async () => {
    await start(); await open(); await bid(fixture.owner1, 100); const old = await head(); await bid(fixture.owner2, 110);
    await expect(undo(old)).rejects.toMatchObject({ statusCode: 409, code: 'STALE_AUCTION_ACTION' });
    expect((await state()).currentBid.amount).toBe(110);
    const latest = await head(); await undo(latest);
    await expect(undo(latest)).rejects.toMatchObject({ statusCode: 409 });
    expect((await state()).currentBid.amount).toBe(100);
  });

  test('does not cross an out-of-band wallet edit or overwrite profile edits', async () => {
    await start(); await open(); await bid(fixture.owner1, 100);
    await Player.updateOne({ _id: fixture.profiles[0]._id }, { $set: { bio: 'New biography' } });
    await undo(); expect((await Player.findById(fixture.profiles[0]._id)).bio).toBe('New biography');
    await AuctionService.resume(fixture.auction._id, fixture.organizer); await bid(fixture.owner1, 100);
    await TournamentTeam.updateOne({ _id: fixture.teams[0]._id }, { $inc: { 'wallet.initialBudget': 5, 'wallet.remainingBudget': 5 } });
    await expect(undo()).rejects.toMatchObject({ statusCode: 409, code: 'AUCTION_ACTION_CONFLICT' });
    expect((await state()).currentBid.amount).toBe(100);
    expect((await TournamentTeam.findById(fixture.teams[0]._id)).wallet.initialBudget).toBe(1005);
  });

  test('rolls back the entire forward command if journal persistence fails; no phantom event is emitted', async () => {
    await start(); await open();
    const listener = jest.fn(); eventBus.on(AUCTION_EVENTS.BID_PLACED, listener);
    const before = (await state()).version;
    jest.spyOn(AuctionActionChange, 'insertMany').mockRejectedValueOnce(new Error('Injected journal failure'));
    await expect(bid(fixture.owner1, 100)).rejects.toThrow('Injected journal failure');
    expect(await Bid.countDocuments()).toBe(0); expect((await state()).currentBid.amount).toBe(0);
    expect((await state()).version).toBe(before); expect(listener).not.toHaveBeenCalled();
    expectBalanced(await wallets()); eventBus.off(AUCTION_EVENTS.BID_PLACED, listener);
  });

  test('two concurrent bids serialize with exactly one winning reservation', async () => {
    await start(); await open();
    const results = await Promise.allSettled([bid(fixture.owner1, 100), bid(fixture.owner2, 100)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await Bid.countDocuments({ status: 'WINNING' })).toBe(1);
    expect((await wallets()).reduce((sum, wallet) => sum + wallet.reservedBudget, 0)).toBe(100);
    expectBalanced(await wallets());
    await undo(); expect((await wallets()).every((wallet) => wallet.reservedBudget === 0)).toBe(true);
  });

  test('undo racing a new bid cannot erase an unreviewed action or leak a reservation', async () => {
    await start(); await open(); await bid(fixture.owner1, 100); const confirmed = await head();
    const results = await Promise.allSettled([undo(confirmed), bid(fixture.owner2, 110)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const snapshot = await state();
    const reserved = (await wallets()).reduce((sum, wallet) => sum + wallet.reservedBudget, 0);
    expect(reserved).toBe(snapshot.currentBid.amount); expectBalanced(await wallets());
    expect([0, 110]).toContain(snapshot.currentBid.amount);
  });
});

describe('next-player selection and public watching', () => {
  test('opens a non-first eligible player, preserves earlier players, and rejects later/wrong rounds', async () => {
    await mongoose.connection.dropDatabase(); await Promise.all(Object.values(mongoose.models).map((Model) => Model.createIndexes()));
    fixture = await seed({ splitRounds: true });
    await start();
    await expect(open(2, fixture.rounds[1])).rejects.toMatchObject({ statusCode: 409 });
    await expect(open(2, fixture.rounds[0])).rejects.toMatchObject({ statusCode: 400 });
    await open(1);
    expect(id((await state()).currentPlayerId)).toBe(id(fixture.players[1]));
    expect((await TournamentPlayer.findById(fixture.players[0]._id)).lotOutcome).toBe('NOT_LISTED');
    await expect(open(0)).rejects.toMatchObject({ statusCode: 409 });
    await settle(false); await open(0); await settle(false); await open(2, fixture.rounds[1]);
    expect(id((await state()).currentPlayerId)).toBe(id(fixture.players[2]));
  });

  test('guests can read every watch endpoint, but cannot mutate or read the private audit', async () => {
    await start(); await open();
    const root = `/api/v1/auctions/${fixture.auction._id}`;
    for (const path of ['', '/live', '/snapshot', '/rounds', '/bids', '/viewers/count']) {
      const response = await request(app).get(root + path).expect(200);
      expect(response.body.success).toBe(true);
    }
    await request(app).post(root + '/viewers/heartbeat').send({ viewerId: 'guest-test' }).expect(200);
    await request(app).post(root + '/viewers/leave').send({ viewerId: 'guest-test' }).expect(200);
    await request(app).get(root + '/actions').expect(401);
    for (const path of ['/undo', '/bids', '/lot/open', '/lot/sold', '/lot/unsold', '/pause', '/resume', '/complete', '/rounds']) {
      await request(app).post(root + path).send({ actionId: id(await head()), amount: 100 }).expect(401);
    }
    const snapshot = await request(app).get(root + '/snapshot').expect(200);
    expect(JSON.stringify(snapshot.body)).not.toContain('undoHeadActionId');
    expect(JSON.stringify(snapshot.body)).not.toContain('restoreFields');
  });

  test('owners, players, and unrelated organizers cannot undo; owning organizer can', async () => {
    await start(); await open(); await bid(fixture.owner1, 100);
    const root = `/api/v1/auctions/${fixture.auction._id}`;
    for (const user of [fixture.owner1, fixture.playerUsers[0], fixture.otherOrganizer]) {
      await request(app).post(root + '/undo').set(authHeader(fixture.token(user))).send({ actionId: id(await head()) }).expect(403);
      await request(app).get(root + '/actions').set(authHeader(fixture.token(user))).expect(403);
    }
    await request(app).post(root + '/undo').set(authHeader(fixture.token(fixture.organizer))).send({ actionId: id(await head()), reason: 'Accidental bid' }).expect(200);
    expect((await state()).currentBid.amount).toBe(0);
  });
});

describe('CricHeroes persistence and validation', () => {
  test.each([
    'javascript:alert(1)', 'https://cricheroes.com.evil.test/player-profile/1/name', 'https://evil.test/player-profile/1/name',
    'https://cricheroes.com@evil.test/player-profile/1/name', 'https://user:pass@cricheroes.com/player-profile/1/name',
    'https://cricheroes.com/team-profile/1/name', 'https://cricheroes.com:444/player-profile/1/name', 'https://cricheroes.page.link/abc?link=https://evil.test',
  ])('rejects unsafe/non-profile links: %s', async (url) => {
    expect(normalizeCricHeroesUrl(url)).toBeNull();
    await request(app).patch('/api/v1/players/me').set(authHeader(fixture.token(fixture.playerUsers[0]))).send({ cricHeroesUrl: url }).expect(400);
  });

  test('profile editing, registration, list projections, and auction snapshots round-trip the canonical link; clearing works', async () => {
    const url = 'https://cricheroes.com/player-profile/9988/coastal-player';
    const token = fixture.token(fixture.playerUsers.at(-1));
    await request(app).patch('/api/v1/players/me').set(authHeader(token)).send({ cricHeroesUrl: 'http://cricheroes.in/player-profile/9988/coastal-player' }).expect(200);
    const submitted = await request(app).post(`/api/v1/tournaments/${fixture.tournament._id}/registrations/players`).set(authHeader(token)).send({ cricHeroesUrl: url }).expect(201);
    await TournamentPlayer.updateOne({ _id: submitted.body.data._id }, { $set: { status: 'APPROVED' } });
    const profile = await request(app).get('/api/v1/players/me').set(authHeader(token)).expect(200);
    expect(profile.body.data.cricHeroesUrl).toBe(url);
    const listing = await request(app).get(`/api/v1/tournaments/${fixture.tournament._id}/registrations/players`).expect(200);
    expect(listing.body.data.find((player) => player.id === submitted.body.data._id).cricHeroesUrl).toBe(url);
    const snapshot = await state();
    expect(snapshot.players.find((player) => id(player) === submitted.body.data._id).playerId.cricHeroesUrl).toBe(url);
    await request(app).patch('/api/v1/players/me').set(authHeader(token)).send({ cricHeroesUrl: '' }).expect(200);
    expect((await Player.findById(fixture.profiles.at(-1)._id)).cricHeroesUrl).toBeUndefined();
  });

  test('player feedback stays private while the public profile link remains available in list projections', async () => {
    await TournamentPlayer.updateOne({ _id: fixture.players[0]._id }, { $set: { status: 'REJECTED', rejectedReason: 'Please correct your submitted details' } });
    const root = `/api/v1/tournaments/${fixture.tournament._id}/registrations/players`;
    const mine = await request(app).get(root + '?userId=me').set(authHeader(fixture.token(fixture.playerUsers[0]))).expect(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].rejectedReason).toBe('Please correct your submitted details');
    const publicList = await request(app).get(root).expect(200);
    expect(publicList.body.data.find((player) => player.id === id(fixture.players[0])).cricHeroesUrl).toBeTruthy();
    expect(publicList.body.data.every((player) => !Object.hasOwn(player, 'rejectedReason'))).toBe(true);
  });

  test('a failed duplicate submission does not partially change the profile link', async () => {
    const before = fixture.profiles[0].cricHeroesUrl;
    await request(app).post(`/api/v1/tournaments/${fixture.tournament._id}/registrations/players`)
      .set(authHeader(fixture.token(fixture.playerUsers[0]))).send({ cricHeroesUrl: 'https://cricheroes.page.link/example123' }).expect(409);
    expect((await Player.findById(fixture.profiles[0]._id)).cricHeroesUrl).toBe(before);
  });
});
