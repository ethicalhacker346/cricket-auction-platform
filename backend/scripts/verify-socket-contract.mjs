/**
 * Cross-checks the socket event contract between:
 *   backend/src/publishers/socket.publisher.js  (server → client broadcasts)
 *   backend/src/socket/handlers/*.js            (client → server handlers)
 *   client/src/features/auction/constants/index.constants.ts (client listener names)
 *
 * This is the check that would have caught the great event-name mismatch:
 * the client listened for `bid:placed` while the server published
 * `auction:bid:placed`, and the client emitted `join:auction` which no
 * backend handler existed for.
 */
import { readFileSync } from 'fs';
import { AUCTION_EVENTS } from '../src/events/auction.events.js';

const publisherSrc = readFileSync(new URL('../src/publishers/socket.publisher.js', import.meta.url), 'utf8');
const auctionHandlerSrc = readFileSync(new URL('../src/socket/handlers/auction.handler.js', import.meta.url), 'utf8');
const clientConstantsSrc = readFileSync(
  new URL('../../client/src/features/auction/constants/index.constants.ts', import.meta.url),
  'utf8'
);

// 1. Every domain event the bus carries must be wired in the publisher.
const registeredHandlers = new Set(
  [...publisherSrc.matchAll(/(?:eventBus\.on|this\.listen)\(AUCTION_EVENTS\.([A-Z_]+)/g)].map((m) => m[1])
);
const unwired = Object.keys(AUCTION_EVENTS).filter((k) => !registeredHandlers.has(k));

// 2. Events the publisher actually broadcasts (publishToAuction / publishToAll).
const published = new Set(
  [...publisherSrc.matchAll(/publishTo(?:Auction|All)\([^,]*,\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1])
);

// 3. Events the client listens for (SOCKET_EVENTS block) / emits (SOCKET_CLIENT_EVENTS block).
const socketEventsBlock = clientConstantsSrc.split('SOCKET_CLIENT_EVENTS')[0];
const clientListeners = new Set(
  [...socketEventsBlock.matchAll(/^\s+[A-Z_]+:\s*"(auction:[^"]+)"/gm)].map((m) => m[1])
);
const clientEmits = new Set(
  [...clientConstantsSrc.split('export const SOCKET_CLIENT_EVENTS')[1].matchAll(/^\s+[A-Z_]+:\s*"(auction:[^"]+)"/gm)].map((m) => m[1])
);

// 4. Events the backend socket handlers process.
const serverHandlers = new Set(
  [...auctionHandlerSrc.matchAll(/socket\.on\("([^"]+)"/g)].map((m) => m[1])
);

let failed = false;
const report = (title, ok, detail) => {
  console.log(`${ok ? '✅' : '❌'} ${title}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed = true;
};

// Declared but intentionally unwired: TIMER_* are publisher-generated (not bus
// events), BID_OUTBID is folded into BID_PLACED payloads, VIEWER_JOINED/LEFT are
// handled ad-hoc in the room handler, ROUND_STARTED is implicit in LOT_OPENED.
const ALLOWED_UNWIRED = ['TIMER_TICK', 'TIMER_SYNC', 'TIMER_EXPIRED', 'BID_OUTBID', 'VIEWER_JOINED', 'VIEWER_LEFT', 'ROUND_STARTED'];

console.log('— Domain events wired to publisher —');
for (const k of Object.keys(AUCTION_EVENTS)) {
  const ok = registeredHandlers.has(k) || ALLOWED_UNWIRED.includes(k);
  if (!ok) report(k, false, 'no publisher listener');
}
if (unwired.filter((k) => !ALLOWED_UNWIRED.includes(k)).length === 0) {
  report('all emitted domain events have publisher listeners', true);
}

console.log('\n— Client listeners vs server broadcasts —');
for (const ev of clientListeners) {
  report(`${ev}`, published.has(ev), published.has(ev) ? '' : 'server never publishes this');
}

console.log('\n— Client emits vs server handlers —');
for (const ev of clientEmits) {
  report(`${ev}`, serverHandlers.has(ev), serverHandlers.has(ev) ? '' : 'no backend socket.on() handler');
}

console.log('\n— Coverage summary —');
const unlistened = [...published].filter((p) => !clientListeners.has(p) && !['auction:joined','auction:left','auction:error','auction:log','auction:timer:tick','auction:global:completed','auction:viewer:joined','auction:viewer:left'].includes(p));
console.log('Server broadcasts the client does not subscribe to (informational):', unlistened.join(', ') || 'none');

process.exit(failed ? 1 : 0);
