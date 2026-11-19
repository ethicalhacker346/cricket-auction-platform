import { createServer } from 'node:http';
import { io as connect } from 'socket.io-client';
import mongoose from 'mongoose';
import { setupTestApp, teardownTestApp } from './helpers.js';
import { seedAuction } from './fixtures/auction.js';
import { initSocket, closeSocketIO } from '../src/socket/index.js';
import { AuctionService } from '../src/services/auction.service.js';
import { BidService } from '../src/services/bid.service.js';
import { AuctionCommandService } from '../src/services/auction-command.service.js';
import { AuctionViewer } from '../src/models/AuctionViewer.js';

let server;
let client;
let fixture;
let root;
const once = (socket, event) => new Promise((resolve) => socket.once(event, resolve));
const ack = (event, data) => client.timeout(5000).emitWithAck(event, data);

beforeAll(async () => {
  const app = await setupTestApp(); fixture = await seedAuction();
  server = createServer(app);
  await initSocket(server, { allowAnonymous: true, corsOrigins: '*' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  root = `http://127.0.0.1:${server.address().port}`;
  client = connect(root, { transports: ['websocket'], auth: {}, reconnection: false });
  await once(client, 'connect');
});
afterAll(async () => { client?.disconnect(); await closeSocketIO(); await teardownTestApp(); });

test('a truly anonymous socket joins, receives bids and undo, and shares one presence row with REST', async () => {
  const auctionId = String(fixture.auction._id);
  const joined = await ack('auction:join', { auctionId, viewerId: 'same-browser-tab' });
  expect(joined.success).toBe(true);
  expect(joined.data.viewerCount).toBe(1);
  await AuctionService.heartbeatViewer(auctionId, 'same-browser-tab');
  expect(await AuctionService.getViewerCount(auctionId)).toBe(1);
  await AuctionService.start(auctionId, fixture.organizer);
  await AuctionService.openLot(auctionId, fixture.organizer, { tournamentPlayerId: fixture.players[1]._id, roundId: fixture.rounds[0]._id });
  const nextBid = once(client, 'auction:bid:placed');
  const nextHead = once(client, 'auction:action:recorded');
  await BidService.placeBid(auctionId, fixture.owner1, { amount: 100 });
  expect(await nextBid).toMatchObject({ auctionId, amount: 100 });
  const head = await nextHead;
  expect(head.version).toBeGreaterThan(0);
  expect(JSON.stringify(head)).not.toContain('undoHeadActionId');
  const recovered = once(client, 'auction:action:undone');
  const latest = (await AuctionCommandService.latest(await mongoose.model('Auction').findById(auctionId))).id;
  await AuctionCommandService.undo(auctionId, fixture.organizer, { actionId: latest });
  expect(await recovered).toMatchObject({ auctionId, auction: { status: 'PAUSED' }, liveState: { currentHighestBid: 0 } });
  const missing = new mongoose.Types.ObjectId().toString();
  const invalidJoin = await ack('auction:join', { auctionId: missing, viewerId: 'invalid' });
  expect(invalidJoin.success).toBe(false);
  expect(await AuctionViewer.countDocuments({ auctionId: missing })).toBe(0);
});

test('one tab cannot multiply its socket identity and shared-tab reconnects keep their presence until the final socket leaves', async () => {
  const auctionId = String(fixture.auction._id);
  const changed = await ack('auction:join', { auctionId, viewerId: 'another-fake-viewer' });
  expect(changed.success).toBe(false);
  const repeated = await ack('auction:join', { auctionId });
  expect(repeated.success).toBe(true);
  expect(repeated.data.viewerId).toBe('same-browser-tab');
  expect(repeated.data.viewerCount).toBe(1);
  expect(await AuctionService.getViewerCount(auctionId)).toBe(1);
  const peer = connect(root, { transports: ['websocket'], auth: {}, reconnection: false });
  await once(peer, 'connect');
  try {
    expect((await peer.timeout(5000).emitWithAck('auction:heartbeat', { auctionId, viewerId: 'not-joined' })).success).toBe(false);
    expect((await peer.timeout(5000).emitWithAck('auction:join', { auctionId, viewerId: 'same-browser-tab' })).success).toBe(true);
    await peer.timeout(5000).emitWithAck('auction:leave', { auctionId });
    expect(await AuctionService.getViewerCount(auctionId)).toBe(1);
  } finally { peer.disconnect(); }
});

test('anonymous sockets have no bid, settlement, or undo command handlers', async () => {
  const auctionId = String(fixture.auction._id);
  const before = (await AuctionService.getSnapshot(auctionId)).version;
  client.emit('auction:bid', { auctionId, amount: 100 });
  client.emit('auction:lot:sold', { auctionId });
  client.emit('auction:undo', { auctionId });
  // A public acknowledged read provides an ordering barrier on this socket.
  await ack('auction:join', { auctionId, viewerId: 'same-browser-tab' });
  expect((await AuctionService.getSnapshot(auctionId)).version).toBe(before);
  await ack('auction:leave', { auctionId });
  expect(await AuctionService.getViewerCount(auctionId)).toBe(0);
});
