# Cricket Auction Platform — Deep Architecture Analysis

> A bottom-up teardown of the auction domain: workflow, state machines,
> concurrency model, realtime architecture, and the design patterns that
> hold it together — plus the cracks found along the way.

---

## Current implementation checkpoint — 2026-11-18

The review below is chronological. **Parts 1–5 preserve findings and verification
at their original checkpoints**; historical blocked tests and compiler counts
are not the current result. [Part 6](#part-6--audited-undo-player-links-next-lot-selection-and-public-spectators)
records the latest implementation and remaining limits.

| Requested capability | Current implementation |
|---|---|
| Organizer undo | Persistent, latest-action-first compensation for bids, decisions, lifecycle, rules, rounds and automatic cascades; confirmed, audited, conflict-checked |
| CricHeroes profiles | Optional create/edit/submission field, validated persistence and safe links throughout public player/auction views |
| Arbitrary next player | Search/select any eligible player in the **running round**, enforced inside the transaction |
| Guest watching | Public live/3D/dashboard/history/analytics/results; no bidding or management privileges |

**Final verification:** 80 client tests / 10 files; 43 backend tests / 4 suites;
hooks lint, 22-event socket contract, syntax checks, diff checks and production
PWA build pass. A separate backend run with open-handle detection exits cleanly
without forced termination. Nine real-browser acceptance checks pass against a
disposable API. Typecheck still fails with **228 diagnostics vs 290 before the
features**, with no new normalized diagnostic messages. Large-bundle warnings
remain. See [the repeatable checks](client/TESTING.md) and the
[operator/deployment guide](docs/AUCTION_SAFETY_AND_SPECTATORS.md).

# Part 1 — Initial architecture and findings (historical baseline)

## 1. What This System Is

**GullyBid** — a production-grade, IPL-style live player auction platform.
Four roles participate:

| Role | What they do |
|---|---|
| `ADMIN` | Platform oversight, all capabilities, dashboards |
| `ORGANIZER` | Creates tournaments, approves players/teams, runs the auction (opens lots, hammers sold/unsold) |
| `FRANCHISE_OWNER` | Owns a franchise → registers a tournament team → bids with a purse |
| `PLAYER` | Maintains a player profile → registers into tournaments → gets auctioned |

**Stack**

- **Backend** (~10.7k LOC): Node 20+, Express 5, Mongoose 8 (MongoDB), Socket.IO 4, Zod, Pino, JWT (access+refresh), Redis (optional: Socket.IO adapter + distributed locks), Cloudinary (images), Docker + Railway deploy via GitHub Actions.
- **Client** (~47k LOC): React 19, TypeScript, Vite 7, Zustand, TanStack Query/Table, socket.io-client, Tailwind 4, **Three.js / react-three-fiber** (an immersive 3D auction arena), jsPDF (squad exports), PWA plugin.

---

## 2. Repository Shape

```
cricket-auction-platform/
├── backend/src/
│   ├── config/        env (fail-fast validation), database, constants ★, logger, shutdown
│   ├── models/        11 Mongoose models (the domain)
│   ├── services/      business logic — all money moves here, in transactions
│   ├── controllers/   thin HTTP adapters (no logic)
│   ├── routes/        REST surface, /api/v1
│   ├── middleware/    auth, authorization, zod validation, rate limits, errors
│   ├── events/        eventBus + auction domain events      ← decoupling layer
│   ├── publishers/    socket.publisher (events → rooms + timers)
│   ├── socket/        Socket.IO bootstrap, auth middleware, handlers
│   └── utils/         jwt, distributedLock (Redis), transport-serializer, helpers
└── client/src/
    ├── features/auction/   engine/ store/ hooks/ api/ components/ pages/ audio/ 3d/
    ├── components/         dashboards, tournament management, auth, ui kit
    ├── pages/              routed screens
    └── store/              authStore (zustand)
```

★ `config/constants.js` is the **single source of truth** for every enum and
state-machine adjacency list in the system. Both model validators and service
guards derive from it — nothing hardcodes status strings.

---

## 3. Domain Model

```
User ─┬─< Player (global profile: role, stats, image)
      ├─< Franchise (global team brand: name, slug, logo)
      └─< Tournament.organizerId

Tournament ─┬─< TournamentPlayer ──> Player        (registration + auction outcome)
            ├─< TournamentTeam  ──> Franchise      (wallet + roster) ★
            └─1 Auction ──┬─< AuctionRound         (ordered player buckets)
                          ├─< Bid                  (append-only history)
                          ├─< AuctionViewer        (presence, TTL'd) ★
                          └─  liveState (embedded) + logs (embedded, capped 200)
```

Two deliberate separation decisions stand out:

1. **Registration status vs auction outcome** are separate fields on
   `TournamentPlayer`: `status` (PENDING/APPROVED/REJECTED — the verification
   trail) vs `lotOutcome` (NOT_LISTED/IN_PROGRESS/SOLD/UNSOLD/
   PERMANENT_UNSOLD — the auction trail). A player can be APPROVED yet
   UNSOLD and re-listed without corrupting verification history.
2. **Presence lives in its own collection** (`AuctionViewer`), never on the
   `Auction` document. Auction uses optimistic concurrency; 15s viewer
   heartbeats × N spectators would constantly collide with bid writes on
   `liveState.version`. Presence gets its own write path + a Mongo TTL index
   (45s) as a backstop sweeper.

### The Wallet (TournamentTeam) — the money invariant

```js
wallet = { initialBudget, spentBudget, remainingBudget, reservedBudget }
invariant: spent + remaining + reserved === initial   (pre-validate hook)
```

All wallet math is centralized in three model methods — services never touch
`wallet.*` fields inline:

| Method | Effect | When |
|---|---|---|
| `reserve(amount)` | remaining → reserved | bid placed (holds the money) |
| `releaseReservation(amount)` | reserved → remaining | outbid, or lot settled unsold |
| `commitSpend(amount)` | reserved → spent | lot settled sold |

This is a textbook **reservation pattern**: at any instant, a team's
exposure is fully accounted, a team can never bid money it doesn't have,
and a crashing mid-auction leaves no ambiguity about where money sits.

---

## 4. The End-to-End Auction Workflow

```
┌─ TOURNAMENT LIFECYCLE ──────────────────────────────────────────────────┐
│                                                                         │
│  DRAFT → PLAYER_REGISTRATION_OPEN → TEAM_REGISTRATION_OPEN              │
│        → TEAMS_APPROVED → AUCTION_SCHEDULED → AUCTION_RUNNING           │
│        → AUCTION_COMPLETED → TOURNAMENT_COMPLETED                       │
│                      (any pre-live state → CANCELLED)                   │
└─────────────────────────────────────────────────────────────────────────┘

 1. Organizer creates Tournament (purse, squadSize, minBidIncrement,
    lotTimerSeconds, currency…)
 2. Players register  → TournamentPlayer(status=PENDING)  → organizer approves
 3. Franchise owners register teams → TournamentTeam(status=PENDING,
    wallet.initialBudget = tournament.defaultPurse) → organizer approves
 4. AuctionService.create()  [requires TEAMS_APPROVED, 1 auction/tournament]
      • Snapshots tournament config into auction.auctionConfiguration
        (copiedAt) — later tournament edits don't mutate a live auction
      • Builds bidIncrementTiers (default: single open-ended tier at
        tournament.minBidIncrement)
 5. Organizer builds AuctionRounds: ordered buckets of tournamentPlayerIds
    (e.g. "Marquee", "Batsmen", "Bowlers"), each with optional category
 6. AuctionService.start()  [requires ≥2 approved teams]
      • Auction: DRAFT/SCHEDULED → LIVE ; Tournament → AUCTION_RUNNING

┌─ LIVE LOOP (repeats per lot) ───────────────────────────────────────────┐
│                                                                         │
│  openLot(player, round)  ── organizer only, auction must be LIVE        │
│    • Guards: no other lot BIDDING; player ∈ round.playerIds; player     │
│      APPROVED + lotOutcome ∈ {NOT_LISTED, UNSOLD}; UNSOLD players may   │
│      only re-list in the dedicated `unsold` round                       │
│    • Round PENDING → ACTIVE (first lot), player → IN_PROGRESS           │
│    • liveState := { currentPlayer, currentRound, highestBid: 0,         │
│      remainingTime: lotTimerSeconds, lotStatus: BIDDING, version+1 }    │
│                                                                         │
│  placeBid(amount)  ── franchise owner only, REST (never socket) ★       │
│    • Full transactional critical path — see §6                          │
│                                                                         │
│  settleLot(sold|unsold)  ── organizer "hammer"                          │
│    sold:   winner commitSpend, roster.push, player SOLD                 │
│    unsold: release winner's reservation, player UNSOLD                  │
│    • liveState reset → PENDING ; then checkRoundCompletion(round)       │
└─────────────────────────────────────────────────────────────────────────┘

┌─ ROUND / AUCTION COMPLETION (engine-driven, automatic) ─────────────────┐
│  checkRoundCompletion: all players in round at terminal outcome?        │
│    normal round → SOLD|UNSOLD ; unsold round → SOLD|PERMANENT_UNSOLD    │
│                                                                         │
│  Last normal round closes →                                             │
│    • unsold players exist? createUnsoldRound() — engine auto-creates    │
│      "Unsold Players Round" (order = last, unique partial index),       │
│      resets those players to NOT_LISTED so openLot can reuse them       │
│    • none? maybeCompleteAuction()                                       │
│                                                                         │
│  Unsold round closes → maybeCompleteAuction():                          │
│    invariant: ZERO approved players in NOT_LISTED|IN_PROGRESS|UNSOLD    │
│    → Auction COMPLETED, Tournament AUCTION_COMPLETED                    │
│                                                                         │
│  Escape hatch: markPermanentUnsold() retires a player from the unsold   │
│  round so the terminal invariant can be reached.                        │
└─────────────────────────────────────────────────────────────────────────┘
```

Every transition is guarded by explicit adjacency lists
(`TOURNAMENT_TRANSITIONS`, `AUCTION_TRANSITIONS`) evaluated in model methods
(`transitionTo`) — illegal jumps throw `INVALID_TRANSITION`, they can't
silently succeed.

### The six state machines

| Aggregate | States |
|---|---|
| Tournament | DRAFT → PLAYER_REG_OPEN → TEAM_REG_OPEN → TEAMS_APPROVED → AUCTION_SCHEDULED → AUCTION_RUNNING → AUCTION_COMPLETED → TOURNAMENT_COMPLETED (+CANCELLED) |
| Auction | DRAFT → SCHEDULED → LIVE ⇄ PAUSED → COMPLETED (DRAFT→LIVE skip allowed) |
| AuctionRound | PENDING → ACTIVE → COMPLETED |
| Lot (liveState.lotStatus) | PENDING → BIDDING → SOLD / UNSOLD |
| Bid | WINNING (current leader / final winner) → OUTBID (terminal), CANCELLED |
| Player lotOutcome | NOT_LISTED → IN_PROGRESS → SOLD / UNSOLD → (re-list) → PERMANENT_UNSOLD |

Domain rule encoded in schema: the `unsold` round must be **last** (no normal
round after it), there can be **only one** (unique partial index), and its
`playerIds` are **engine-managed** (manual tampering rejected in
pre-validate).

---

## 5. Tiered Bid Increments

Not a flat increment — a ladder, owned by the **auction** (not the
tournament), because it drives live bidding mechanics and may differ for a
re-auction:

```js
bidIncrementTiers: [
  { upTo: 100,  increment: 5  },   // below 1 Cr: +5L
  { upTo: 200,  increment: 10 },   // …
  { upTo: null, increment: 50 },   // "and above" — exactly one, must be last
]
```

Schema validation enforces: ascending, no duplicate boundaries, exactly one
open-ended tier. `auction.getBidIncrement(currentBid)` is the single
canonical lookup — `BidService` calls it rather than re-deriving.

---

## 6. The Bidding Critical Path (placeBid, annotated)

This is the hottest, most hardened code path in the system — **REST only,
never socket**, because bids require multi-document transactions:

```
1. Authorization: AuctionAuthorizationService.assertPermission(PLACE_BID)
   → identity + ownership + state machine (see §8)
2. Open MongoDB transaction session
3. Load auction; must be LIVE, liveState.lotStatus === BIDDING
4. Re-resolve the acting team INSIDE the tx, by _id + ownerId +
   tournamentId + status=APPROVED  ★ (never trusts client-sent teamId —
   closes the "team suspended between authz and commit" gap)
5. Guards: roster < squadSize · amount ≥ (highestBid==0 ? basePrice :
   highestBid + tierIncrement) · not already highest bidder ·
   team.canAfford(amount)
6. Outbid bookkeeping: previous team releaseReservation(); their WINNING
   bids → OUTBID
7. New team reserve(amount); create Bid(status=WINNING)
8. Anti-snipe: remainingTime = max(trueRemaining, bidResetSeconds)
   (computed from liveState.updatedAt drift, not blind trust)
9. liveState.version += 1; append BID_PLACED log; save
   (optimisticConcurrency: a losing racer gets VersionError → tx aborts)
10. COMMIT — and only then emit domain events (fire-and-forget) + create
    notification. Side effects never precede the commit.
```

Consistency layers stack: **transaction** (atomicity) +
**optimisticConcurrency** on Auction/TournamentTeam/TournamentPlayer
(lost-update protection) + **wallet invariant** validator (corruption
tripwire) + **rate limiter** (`bidRateLimiter`) + client-side
**bidInFlight lock** (double-tap protection before the network round trip).

---

## 7. Settlement & Auto-Progression

`settleLot` is the organizer's hammer. On SOLD it commits the reservation to
spent, pushes to the roster, stamps the player (sold state is all-or-nothing
per validator), and resets liveState. Then the **engine takes over**:
`checkRoundCompletion` → round lifecycle events → auto-create the unsold
round or auto-complete the auction — with an idempotency race-guard
(`findOne` for existing unsold round inside the tx) and graceful swallowing
of `VersionError`/`INVALID_TRANSITION` in `maybeCompleteAuction` (a second
worker completing first is fine).

---

## 8. Authorization — a 3-Layer Pipeline

```
IdentityResolver          OwnershipResolver            PermissionEngine
(who are you?)            (what do you own?)           (may you act, now?)
role → capabilities   +   tournament/team facts   +    auction state gates
─────────────────────────────────────────────────────────────────────────
user:{role,isActive}      ownsTournament               STATE_RULES:
capabilities: Set          team.owns / team.approved     PLACE_BID  → [LIVE]
  ORGANIZER → manage*,     ownershipScope                 OPEN_LOT  → [LIVE]
    open/settle lot…                                    PAUSE      → [LIVE]
  FRANCHISE_OWNER →       (pure functions,                RESUME     → [PAUSED]
    PLACE_BID only          no DB, trivially              …
    (and only with an       unit-testable)           + OWNER_REQUIRED set
    owned+APPROVED team;                             + precise denial reasons
    no admin bypass —       e.g. TOURNAMENT_TEAM_NOT_APPROVED
    bidding moves a real
    wallet)
```

- Context built once per request (`requireAuctionPermission` middleware),
  cached on `req.authorization`, re-used by the service via a `sameContext`
  guard — no double DB work, no stale-context trust.
- The **server is the sole authority**: the frontend fetches
  `GET /auctions/:id/permissions` and only layers UI-polish constraints on
  top (`withLiveStateConstraints`) which can narrow but never widen.
- `POLICY_VERSION` is stamped into every context — policy changes are
  auditable.

---

## 9. Realtime Architecture

```
REST service ──(after tx commit)──▶ auction.events emitXxx()
                                        │  toTransportDTO (Mongoose→plain)
                                        ▼
                                   eventBus (in-process EventEmitter,
                                        safeEmit never throws)
                                        │
                          SocketEventPublisher (singleton)
                                        │
              ┌─────────────────────────┼──────────────────────────┐
              ▼                         ▼                          ▼
   io.to(`auction:{id}`)      server-authoritative            presence events
   domain broadcasts          LOT TIMER:                       viewer join/leave
   (lot opened, bid placed,   1s ticks + 5s full sync          + count
   sold, liveState, logs…)    + expired, pause/resume,
                              anti-snipe adjustTimer
```

Design choices worth noting:

- **One-way data flow**: clients *command* over REST, *observe* over sockets.
  The socket handler exposes only read/subscribe operations (`auction:join`,
  `heartbeat`, `getLiveState`, `getSnapshot`) — never a mutation.
- **Room model**: `auction:{auctionId}` rooms; `user:{userId}` personal rooms
  for direct notifications; anonymous spectators allowed (token optional,
  downgrade-not-reject on bad token).
- **Transport hygiene**: events pass `toTransportDTO` upstream and a
  transport-level sanitizer (circular-ref guard, Date→ISO) at publish time,
  with a dev-mode `JSON.stringify` smoke test.
- **Timer authority lives server-side** (tick/sync/expired), clients
  interpolate between syncs.
- **Scaling hooks**: Redis adapter for Socket.IO when `REDIS_URL` is set;
  per-IP connection cap (10/min); per-message deflate; `withDistributedLock`
  utility for cross-instance cron mutual exclusion.
- **Presence is dual-tracked**: in-memory map in the socket handler (instant)
  + `AuctionViewer` TTL collection (durable, REST-visible). Client sends 15s
  heartbeats + `sendBeacon` on tab close.

---

## 10. Frontend — the AuctionEngine

The client mirrors the server's discipline with a **class-based state machine
singleton** (`features/auction/engine/AuctionEngine.ts`, ~1k LOC) bridged
into React through Zustand:

- **Snapshot pattern**: engine holds mutable private state → `getSnapshot()`
  returns immutable copies → subscribers (the zustand store) re-render.
- **Connection generations**: every `connect()` increments a generation
  counter; every socket handler, timeout, and interval checks it — stale
  callbacks from a previous auction/connection can't corrupt current state.
- **Terminal-state guarantees**: `completed` stops all timers, sockets, and
  pending callbacks; a completed auction is never resurrected.
- **Reconciliation**: socket events are the fast path; a sequential 10s
  `setTimeout` chain re-fetches the REST snapshot as the correctness floor
  (compares `version` to detect drift; synthesizes sold/unsold events from
  player-status diffs if a socket event was missed).
- **Mobile-hardened**: `online` + `visibilitychange` listeners force a clean
  reconnect (backgrounded tabs suspend sockets/timers); socket auth reads
  the token via callback so rotated JWTs are picked up on reconnect;
  unlimited reconnect attempts with jittered backoff.
- **Timer**: 250ms local interpolation between server syncs
  (`setTimerBaseline` + elapsed-since-sync), matching the server's
  anti-snipe reset.
- **Server-authoritative permissions** via `/permissions` endpoint
  (see §8); role→team resolution prefers the server's `tournamentTeamId`.
- Plus: audio engine driven by a **StateDiffEmitter** (diffs snapshots →
  sound events), a full **3D auction arena** (react-three-fiber HUD, bid
  dock, error boundary), sold/unsold animations, squad PDF export,
  analytics charts.

---

## 11. Operational Posture

- **Hardened HTTP**: Helmet CSP (Cloudinary img allowlist), strict CORS
  (no wildcard in prod), 10kb body cap, request-ID propagation, pino-http
  structured logs, `/health` + `/ready` probes.
- **Fail-fast env** validation; **graceful shutdown** with connection
  draining (HTTP → Socket.IO → Redis → Mongo).
- **Testing**: Jest + mongodb-memory-server (no external DB needed);
  CI runs test+lint before Railway deploy on `main`.
- **Rate limiting**: global limiter + dedicated bid limiter + socket
  connection caps.

---

## 12. ⚠️ Critical Findings

### 🔴 F1 — The realtime socket contract is broken end-to-end (live bidding silently runs on REST polling)

Two independent mismatches between `client/.../AuctionEngine.ts` and the
backend socket layer:

**(a) Room join names don't match.** Engine emits `join:auction` /
`leave:auction`; backend listens for `auction:join` / `auction:leave`
(`socket/handlers/auction.handler.js`). There is no `join:auction` handler
anywhere. **The engine's socket never joins the `auction:{id}` room**, so
every `io.to(room).emit(...)` broadcast passes it by. (The older
`lib/socket-client.ts` uses the correct names — but AuctionEngine creates
its own socket and doesn't use that module.)

**(b) Broadcast event names don't match.** Even if the room join worked:

| Backend publishes | Engine listens for | Match |
|---|---|---|
| `auction:started` / `paused` / `resumed` / `completed` / `rules:updated` | same | ✅ |
| `auction:lot:opened` | `lot:opened` | ❌ |
| `auction:bid:placed` | `bid:placed` | ❌ |
| `auction:lot:sold` / `lot:unsold` | `lot:sold` / `lot:unsold` | ❌ |
| `auction:liveState` | `live:state:updated` | ❌ |
| `auction:round:added/updated/deleted/completed` | `round:added/…` | ❌ |
| `auction:viewer:count` | `viewer:count:updated` | ❌ |
| `auction:timer:tick/sync/expired` | *(no listeners at all)* | ❌ |

**Net effect**: the live auction UI works only through its 10-second REST
snapshot reconciliation + optimistic local updates — bids from *other* teams
appear up to 10s late, server timer ticks never arrive, viewer counts never
update live. The fix is mechanical (align names to the `auction:*`
namespace, use `auction:join`), but until then the entire carefully-built
pub/sub realtime layer is dead code in production.

### 🔴 F2 — `markPermanentUnsold` can strand a live lot + leak wallet reservations

In `auction.service.js` the guard rejecting `IN_PROGRESS` players is
**commented out**, and the allowed source states include `IN_PROGRESS`. If
the organizer marks the *currently open* player permanent-unsold:

- the leading team's `reservedBudget` is never released (**wallet leak**),
- `liveState` stays `BIDDING` on a now-terminal player,
- `openLot` is then blocked ("a lot is already open"), while
  `settleLot(sold)` would hit the player validator ("permanently unsold
  cannot carry sold state") — the only recovery is settling it unsold,
- `checkRoundCompletion` counts the player as resolved, so the round (and
  auction) can complete **while a lot is still open on it**.

Either reinstate the IN_PROGRESS guard, or make the operation settle the
open lot (release reservation, reset liveState) atomically first.

### 🟠 F3 — Timer expiry is not enforced on bid placement

`placeBid` validates `lotStatus === BIDDING` but never checks
`trueRemaining > 0`. A bid landing after the server timer expired (lot still
open) is accepted and *resets* the clock to `bidResetSeconds`. If the
intended model is auctioneer-controlled hammer (IPL-style), this is fine but
should be an explicit, documented choice; if the timer is meant to be
binding, it's a hole.

### 🟠 F4 — Server timers are instance-local under horizontal scaling

`SocketEventPublisher.activeTimers` is an in-process `Map`. With the Redis
adapter, room membership is shared, but the **eventBus is in-process** — a
bid landing on instance B adjusts only B's timer while instance A's timer
(kept from `openLot`) keeps ticking stale into the same room → clients see
conflicting ticks; if the timer-owning instance dies, ticks stop entirely.
Single-instance deployments are unaffected. Multi-instance needs the timer
moved to a Redis-backed owner (the `withDistributedLock` primitive already
exists for this).

### 🟡 F5 — Dual presence sources can disagree

Socket joins publish the **in-memory** viewer count; REST/socket heartbeats
publish the **DB** count — both on the same `viewer:count`-style event.
Clients can see the number oscillate between the two sources. Pick one
authority (DB) or reconcile before publishing.

### 🟡 F6 — Hygiene / smaller items

- `console.log(payload.bidIncrementTiers)` and `console.log(req.body)` left
  in `auction.service.js` / `auction.controller.js` (logs request bodies —
  noise + potential data exposure); `socket.publisher` logs room internals
  on every event.
- Dead code: `TournamentTeam.budgetUtilization` virtual returns `undefined`
  (body commented out); `lib/socket-client.ts placeBid()` emits a socket
  `auction:bid` the backend deliberately never handles (bids are REST-only)
  — a trap for future callers.
- `.idea/` committed to the repo.
- Losing bid races surface as raw `VersionError`→500 rather than a clean
  409/retry hint (the `liveState.version` doc comment describes a
  read-then-conditional-write retry that the code doesn't actually
  implement — it relies on Mongoose `optimisticConcurrency` instead).

---

## 13. What's Genuinely Excellent Here

1. **The money protocol** — reserve/release/commit + a schema-enforced
   invariant is exactly right for auction wallets, and the invariant turns
   any future wallet bug into a loud validation failure instead of silent
   drift.
2. **Events only after commit** — the service layer is rigorously
   transaction-first, side-effects-second. The eventBus can't be poisoned
   by rolled-back state.
3. **Authorization as pure functions** — Identity/Ownership/Permission
   separation with denial *reasons* (`TOURNAMENT_TEAM_NOT_APPROVED` vs
   `AUCTION_NOT_LIVE`) is testable, auditable (`POLICY_VERSION`), and the
   server-authoritative `/permissions` endpoint keeps the client honest.
4. **Domain rules encoded in the schema** — unsold-round-last, one-unsold-
   round partial index, sold-fields all-or-nothing, tier-ladder validation,
   completedAt ≥ startedAt. Bad states are unrepresentable, not just
   rejected by convention.
5. **Concurrency is layered, not hoped for** — transactions + optimistic
   concurrency + separate collections for hot-vs-cold writes (presence vs
   bids) + client-side in-flight locks.
6. **The client engine's paranoia** — generation counters, terminal-state
   seals, reconciliation floor, mobile recovery hooks. This is how you
   build realtime UIs that survive 3G handoffs.
7. **Comments that explain *why*** — the codebase documents its own design
   decisions (and even past bugs, e.g. the `bidResetSeconds` history) at
   the exact point of confusion. Rare and valuable.

---

## 14. Recommended Fix Order

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | Align socket event names + room join (`auction:*` namespace, `auction:join`) in `AuctionEngine.ts` / constants | S | **Restores the entire realtime layer** |
| 2 | Reinstate/repair the `IN_PROGRESS` guard in `markPermanentUnsold` (or settle-then-mark atomically) | S | Closes wallet leak + stuck-lot |
| 3 | Decide & enforce timer-expiry semantics in `placeBid` | XS | Rules integrity |
| 4 | Single-source viewer counting | S | UI correctness |
| 5 | Strip console.logs, dead virtual, dead socket `placeBid`; ignore `.idea/` | XS | Production hygiene |
| 6 | Redis-backed timer ownership for multi-instance | M | Horizontal scaling |
| 7 | Map `VersionError` on bid race → 409 with retry semantics | S | API polish |

---

# Part 2 — Fixes Applied (this branch)

## ✅ Fixed

**F1 — Realtime socket contract (the big one).**
- Client `SOCKET_EVENTS` re-aligned to the server's `auction:*` namespace
  (14 event names corrected: `round:*`, `lot:*`, `bid:placed`,
  `live:state:updated`, `viewer:count:updated` → their real server names).
- Room protocol fixed: engine now emits `auction:join` / `auction:leave`
  with `{ auctionId }` (was `join:auction` / `leave:auction`, which no
  backend handler existed for — the socket never joined the room). Join ack
  now adopts the server viewer count.
- `VIEWER_COUNT_UPDATED` handler now reads `payload.viewerCount` (it read
  `payload.count`, a field the server never sends — live counts were dropped
  even after the names were fixed).
- New client listeners: `auction:timer:sync` / `auction:timer:expired` /
  `auction:timer:stopped` pin the local 250ms interpolation to the
  server-authoritative clock instead of drifting between bid events.
- New `auction:lot:permanent_unsold` event end-to-end: domain event +
  emitter (`auction.events.js`), publisher handler, service emission after
  commit, client listener that updates player status + fires the
  `permanentUnsoldEvent` animation trigger. Previously this state change
  only surfaced via the 10s snapshot diff.
- New publisher handlers for `AUCTION_CREATED` and `LOT_PERMANENT_UNSOLD`
  (both were emitted on the bus with no listener — silent no-ops).
- Dead `client/src/lib/socket-client.ts` deleted (unused, and its
  socket-based `placeBid` was a trap — bids are REST-only by design).
- **Regression guard**: `backend/scripts/verify-socket-contract.mjs`
  statically cross-checks server broadcasts vs client listeners vs client
  emits vs server handlers. 20/20 green. Run it in CI to make this class of
  bug unshippable.

**F2 — `markPermanentUnsold` wallet-leak/stuck-lot.** Reinstated the
`IN_PROGRESS` guard with a precise error message. An open lot can no longer
be retired mid-flight; the leader's reservation can't be stranded, and a
round can no longer "complete" while a lot is open on it.

**F3 — Pause/resume clock truth.**
- Server: `pause()` now freezes `liveState.remainingTimeSeconds` (drift-
  adjusted) and `resume()` re-baselines `updatedAt` — `getSnapshot` no longer
  under-reports remaining time after a pause.
- Client: local countdown freezes on `auction:paused` (tick() no-ops while
  paused) and re-syncs from a fresh snapshot on `auction:resumed`.

**F5 — Viewer-count single source.** Socket join/leave now publish the
DB-backed count (returned by `heartbeatViewer`/`removeViewer`) instead of
the diverging in-memory map count; in-memory remains fallback-only.

**F6 — Hygiene.** Removed `console.log(req.body)` / tier debug logs from
controller + service; gated the publisher's per-event log (fired every timer
tick) behind `DEBUG_SOCKET`; root `.gitignore` added; `.idea/` untracked.
Also fixed a repo-wide blocker found along the way: `client/tsconfig.json`
had `ignoreDeprecations: "6.0"`, invalid for the installed TS 5.9.3 — every
`tsc --noEmit` run failed before typechecking anything. Now `"5.0"`.

## Verified

- `node --check` passes on all modified backend files.
- `tsc --noEmit`: **zero errors in all touched files** (445 pre-existing
  errors elsewhere in the repo remain — the project never had a working
  typecheck gate; worth its own cleanup pass).
- `vite build` succeeds end-to-end (PWA + 3D bundle).
- Backend Jest suite can't run in this sandbox: mongodb-memory-server needs
  `fastdl.mongodb.org` (outside sandbox network allowlist). Suite boots
  correctly given `SMTP_HOST/SMTP_USER/SMTP_PASS` env vars — another
  pre-existing gap: `tests/setup.js` doesn't set them though
  `config/env.js` requires them.

## Still open (by design / needs a product decision)

- **F3 (timer-expiry semantics)**: `placeBid` accepts bids after timer
  expiry while the lot is open — consistent with an auctioneer-controlled
  hammer (nothing auto-settles on expiry), but if the timer should be
  binding, enforce `trueRemaining > 0` server-side. Needs a product call.
- **F4 (multi-instance timers)**: publisher timers are in-process Maps; with
  the Redis adapter, cross-instance bids don't adjust the originating
  instance's timer. Single-instance deploys (current Railway setup) are
  unaffected.
- **F7**: bid races surface as `VersionError`/500 rather than a clean 409.

---

# Part 3 — Auction Lifecycle Deep Dive (second pass)

This pass went under the happy path: transaction boundaries, lifecycle
entry-point collisions, and the registration → auction funnel invariants.

## 🔴 Found & fixed

**L1 — Domain events fired *inside* uncommitted transactions.**
`settleLot` called `checkRoundCompletion` mid-transaction, and that chain
(`handleNormalRoundClosed` → `createUnsoldRound` / `maybeCompleteAuction`)
emitted `ROUND_COMPLETED`, `ROUND_ADDED`, and `AUCTION_COMPLETED` **before
the outer commit**. If the outer transaction then aborted (e.g.
VersionError on the auction save), clients were told about rounds and
completions that never happened — the exact invariant the codebase works
to keep everywhere else. Fixed with an **outbox pattern**: the completion
chain accepts an `outbox` array; when running inside a caller's
transaction it defers emissions, and `settleLot` drains the outbox
immediately after `commitTransaction()`. Standalone callers
(`markPermanentUnsold`) emit directly as before.

**L2 — A notification failure could roll back a financial settlement or
fake-fail a placed bid.** `NotificationService.create` was awaited
*inside* `settleLot`'s transaction (its failure would abort the sale) and
unprotected *after* `placeBid`'s commit (its failure returned a 500 for a
bid that existed — a client retry would then hit "already highest bidder"
and look like a phantom rejection). Notifications are now best-effort,
post-commit, and log-then-swallow everywhere (bid service + registration
service `notifySafely`).

**L3 — Parallel tournament-lifecycle entry points collided.** The client
calls `POST /tournaments/:id/schedule-auction` and `start-auction`, which
drive the *tournament* state machine directly — while
`AuctionService.create()`/`start()` drive the *same* transitions. Calling
schedule-auction before creating the auction made auction creation throw
`INVALID_TRANSITION` (AUCTION_SCHEDULED → AUCTION_SCHEDULED is not in the
adjacency list). Both tournament-level methods and the auction
create/start paths are now idempotent against already-achieved states.

**L4 — Mid-auction rejections corrupted the auction.**
- `rejectPlayer` had no guards: rejecting the **IN_PROGRESS** player let a
  team buy a rejected player; rejecting any round-referenced player left
  the round unresolvable forever (rounds complete only when every member
  reaches a terminal outcome, and a rejected player can never be listed) —
  a **permanently stuck auction**. Now: rejection is idempotent (no double
  count-decrement), blocked once `lotOutcome ≠ NOT_LISTED`, and blocked
  while the player is referenced by any auction round.
- `rejectTeam` had no guards: rejecting a team mid-auction stranded its
  wallet reservation and allowed settlements into a rejected roster. Now
  idempotent and blocked once the tournament reaches AUCTION_RUNNING.

**L5 — Client-supplied round `type` could wedge the engine.**
`addRound` accepted `type: 'unsold'` from the API, creating an *unmanaged*
unsold round (its players never reset to NOT_LISTED) — the engine's own
`createUnsoldRound` would then no-op on the existing round, and the
auction could never reach terminal state. The service now forces
`type: NORMAL`, and `updateRound` rejects any type change with a 400
(type is engine-managed).

**L6 — Registration never actually closed.** `markTeamsApproved`
transitioned the tournament but left `playerRegistrationOpen` /
`teamRegistrationOpen` true — brand-new teams with full purses could
register and be approved *while the auction was live*. Both flags now
close at TEAMS_APPROVED.

**L7 — Smaller hardening.**
- `placeBidSchema.amount` now requires `.int()` (clean 400 instead of a
  Mongoose ValidationError); `updateAuctionRulesSchema.bidIncrementTiers`
  rejects empty arrays at the edge.
- The strict per-user bid limiter (`auctionRateLimiter.js`, 5 bids/2s)
  existed but was dead code — routes used the 6000/min global-shaped one.
  Now wired in; its 429 payload returns `{ success: false, message }`
  like every other API error.
- `registerPlayer` now wraps registration + counter increment in a
  transaction (matching `registerTeam`), so `playersCount` can't drift.
- `listTeams` populated ghost fields `brandColor`/`shortCode` that don't
  exist on Franchise (silently undefined) — now selects the real
  `colorFrom`/`colorTo` and maps them through.
- Client engine's `formatQuick` rendered raw-rupee amounts as lakhs
  (a ₹1 Cr bid logged as "₹100000 Cr") — replaced with the codebase's
  canonical `formatLakhs`.

## Verified

- `node --check` green on every touched backend file.
- Socket contract verifier still 20/20 green.
- `tsc --noEmit`: zero errors in touched files (the one new-looking hit
  was a pre-existing unused import in an untouched file).
- `vite build` succeeds.

## Still open

- `TEAMS_REJECTED` tournament status is defined but unreachable in
  TOURNAMENT_TRANSITIONS — dead state, decide whether rejection of the
  whole cohort should be a real transition or the enum entry dropped.
- Tournament rename regenerates the slug without a friendly 409 on
  collision (raw duplicate-key → handled as generic 409 by errorHandler).
- The 445 pre-existing client type errors remain a separate cleanup.

---

# Part 4 — World-Class Presentation & Realtime Polish

## R4.1 — Activity-timeline error loop: "Socket unavailable: Invalid namespace"

**Root cause:** socket.io-client parses any path in the connection URL as a
**namespace**, not a transport path. If `VITE_SOCKET_URL` carries a path
(`/api/v1`, `/socket.io`, a trailing slash combo), the server rejects the
handshake with `Invalid namespace`, the client falls back to REST, retries,
and the timeline fills with the alternating error/connected loop.

**Fix (`client/src/features/auction/engine/AuctionEngine.ts`):** the socket
now connects to `resolveSocketOrigin(WS_URL)` — the stripped origin only —
with the transport path pinned explicitly via `path: "/socket.io"`. A
comment records the invariant. Additionally, `pushLog` collapses
consecutive duplicate messages into one entry with a `×N` counter, so even
if a future transport failure retries, the timeline stays readable.

## R4.2 — World-class sound (`audio/AuctionAudioManager.ts`)

Replaced the file-based engine (per-play `new Audio()` clones — latency,
overlap glitches, 13 network dependencies) with a **fully synthesized
WebAudio engine**: zero assets, sample-accurate scheduling on the
AudioContext clock, and a mastered signal chain
`voice → masterGain → compressor → destination` with a generated
impulse-response convolver reverb bus. Voices: layered paddle-tap+coin bid,
FM opening bell, triple-gavel + applause swell + C-major fanfare for SOLD,
detuned descending sigh for UNSOLD, riser→impact auction start, woodblock
urgency ticks (pitch rises ≤5s, heartbeat thump at 1s), soft closing buzzer
on expiry. Gesture unlock on first interaction; unified mute key
(`auction_audio_muted`) with smooth gain ramping.

## R4.3 — World-class verdict card (`components/SoldUnsoldAnimation.tsx`)

Full cinematic rebuild: letter-cascade verdict with landing bounce, corner
ribbon, three gavel-rap marks, shockwave rings, film grain, spotlight,
scrolling SOLD ticker, 48-piece confetti (sold) / falling price-tag rain
(unsold), sweep shine, animated INR amount counter, backdrop/Escape/button
dismissal. Its old parallel sound engine was replaced by the same
synthesized-score approach (shared AudioContext + reverb) with the TTS
announcer kept as an opt-in garnish under the score. Mute state now shares
the unified `auction_audio_muted` key.

## R4.4 — World-class timer (`components/AuctionClock.tsx`)

Rebuilt as an instrument-grade dial: gradient arc + blurred glow underlay +
travelling comet head + 60 tick marks, per-digit vertical slide transitions
with blur, four urgency bands (calm/warn/hot/critical) that escalate color
and glow, an expanding heartbeat ring + pulsing inset vignette in the final
5 seconds, and an accessible `role="timer"` with live-region labelling.
Digits remain server-authoritative from the live store; the arc animates on
a crisp 1-second linear beat so depletion is legible rather than drifty.

**Verification:** scoped `tsc --noEmit` clean on all touched files (0 new
errors; repo-wide count unchanged), `vite build` green (1m15s),
`verify-socket-contract.mjs` 20/20 green.

---

# Part 5 — Runtime UI lifecycle repair and regression gates (2026-11-18)

## R5.1 — Root causes, not React internals

The `Expected static flag was missing` warning was caused by
`PlayerAuctionCard` returning its empty state **before** calling
`useImageFallback`. Empty → populated → empty lots therefore changed the
component's hook/static-effect layout. The hook now runs unconditionally;
image failures are associated with their URL rather than reset in an effect.
The same audit found and fixed a callback hook below the authorization guard
in `FranchiseForm`. `AuctionRoundsPage` now uses the canonical `AuctionRoutes`
helper instead of a misleadingly hook-named, conditionally invoked local
route builder.

The verdict rewrite had also broken its public contract: all three auction
pages still mounted `<SoldUnsoldAnimation />`, but that export had become a
presentational component requiring player data and an optional close callback.
It consequently had neither a live event lifecycle nor a functioning dismiss
operation. Separately, `controls.start()` was invoked from a ref callback
before Framer Motion's controls were mounted. Real DOM tests reproduced that
exception; the entrance is now declarative.

## R5.2 — One new event, one bounded reveal

`useAuctionVerdict` subscribes to the existing store without bootstrapping
another connection. It seeds its sequence baseline at mount, chooses the
newest sold/unsold event using the engine's shared sequence, captures immutable
presentation data, and ignores repeated/cloned snapshots. Missing player data
can arrive after the event without producing a blank overlay. Opening another
lot (including re-listing the same player), changing context, or resetting the
engine dismisses the old reveal. Event-qualified dismiss callbacks cannot
close a newer event.

The restored no-props `SoldUnsoldAnimation` host is memoized to isolate the
animation tree from the page's 250ms clock updates. Its strict view requires
`onClose`; cross, Escape, backdrop, and the 4200ms SOLD / 3000ms UNSOLD deadline
share an idempotent close path. Callback identity changes do not extend that
deadline. Presence/exit is owned by the connected host, not an always-mounted
inner `AnimatePresence`.

REST reconciliation now compares only known players from the same auction.
Historical SOLD/UNSOLD entries in a first snapshot are baselines, not live
verdicts. Subsequent genuine transitions still emit exactly once.

## R5.3 — Modal, fullscreen and mobile behavior

A stable portal escapes page transforms/stacking contexts. Its container moves
into the native fullscreen element without remounting the reveal, replaying
audio, or restarting the deadline. Dismiss gets initial focus; Tab/focus remain
inside the dialog; close/exit/unmount restore prior focus and the exact prior
body overflow. Exiting content is inert and no longer intercepts pointers.

Controls have 44px touch targets and visible focus rings. Long team names wrap,
prices remain together, broken logos fall back to initials, and the countdown
is visible. Motion preferences suppress decorative particles/ticker effects.
Team tints use `color-mix`: `mapFranchise` generates `hsl()` colors, so appending
hex alpha suffixes (such as `hsl(...)44`) was invalid CSS. Amounts now use the
existing shared currency formatter rather than a less precise duplicate.

## R5.4 — Audio is owned and released

The previous `4029b89` correction targets gain automation at `.gain` AudioParams.
This patch adds score/announcement cleanup on close, mute, exit and unmount,
including graph disconnection and utterance-specific speech cancellation.
Unavailable WebAudio still degrades to a usable, dismissible visual reveal;
unsupported reverb falls back to a dry score.

Mute is synchronized between the reveal and the mounted manager, both in the
same document and across tabs. Corrupt or unavailable storage cannot crash the
manager or prevent an in-session mute. `useAuctionSounds` creates its manager
inside an effect: StrictMode's setup → cleanup → setup now leaves exactly one
live manager instead of a leaked render-time instance and a destroyed ref.
Destroy is idempotent and removes gesture, event-bus, preference and store
subscriptions; a later click cannot resurrect a destroyed context.

## R5.5 — Verification and correction to earlier claims

The earlier scoped-typecheck claim missed errors in **callers**: three missing
verdict-prop diagnostics came from the earlier rewrite, not an unrelated
baseline. Those three errors and an unused import are fixed here. The real
TypeScript **5.9.3** compiler reports **294 → 290 diagnostics, zero newly added**.
The remaining repo-wide diagnostics are unchanged; `npm run typecheck` still
correctly exits nonzero. The repository is **not** being described as fully
typecheck-clean.

Verified in this patch:

- `npm run lint:hooks`: passes across **all** client TypeScript components.
- `npm test`: **37/37 tests across 6 files**, using real React 19 and Framer
  Motion, StrictMode, deterministic clocks, strict WebAudio stand-ins, store
  integration and the engine's public connect/reconcile flow. A separate
  real-timer animation test waits for the entered overlay to be physically
  removed after exit. Unexpected React console errors fail the suite, so an
  error boundary silently returning null cannot make a test pass.
- `npm run build`: production/PWA build succeeds (51.64s); existing large-chunk
  warnings remain.
- `node backend/scripts/verify-socket-contract.mjs`: all 20 server event
  subscriptions and both client room commands pass.
- One-off real Chromium UI smoke checks: repeated empty/player transitions,
  actual cross clicks and touch taps, original auto-dismiss deadlines while a
  parent re-renders with cloned 250ms snapshots, Escape/backdrop, focus/scroll
  restoration, real WebAudio unmute, native fullscreen transitions, 390px mobile
  layouts with long team names/HSL tints, and reduced-motion mode. No uncaught
  browser exceptions or React console errors. These use the real components
  with fixture state, **not** an authenticated production-backend session.

Test dependencies are dev-only. Temporary browser binaries, screenshots and
fixture pages are not shipped or committed. See `client/TESTING.md` for the
repeatable checks.


---

# Part 6 — Audited undo, player links, next-lot selection and public spectators

## R6.1 — The auction command boundary is now the integrity boundary

`AuctionCommandService.run` wraps auction mutations in a snapshot/majority
transaction. It rebuilds authorization **inside** that transaction, journals
scoped business values, writes the Auction as a serialization fence, and
publishes only after commit. Transaction retries recreate their journal and
side-effect queues; aborted transactions cannot announce a sale or completion.
Notifications run after realtime publications and cannot fake-fail a committed
bid. Version/write conflicts return a clean 409.

```
Auction (private head, monotonic liveState.version, lastUndoVersion)
   └─ AuctionAction (small audit header, previousActionId)
         └─ AuctionActionChange × related resource
              field-scoped before / after / mutable fields / safety guards
```

`AuctionActionChange` stores separate per-resource images rather than embedding
an ever-growing undo stack in Auction. No player-profile/user credential data or
presence is captured. Wallets, rosters, player outcomes, round assignment/state,
lifecycle/configuration and bid status are compensated together. Bid records
created by undone bids remain **CANCELLED**, not deleted; bid analytics exclude
them while the feed/history retain explicit labels.

`POST /auctions/:id/undo` requires the exact current action ID and the auction's
organizer/admin. `GET /auctions/:id/actions` returns the latest 30 audit headers
to the same audience; private images/head are never serialized publicly. Undo
validates **all** post-images before any restoration. Independent profile edits
survive; incompatible wallet, approval, ownership or base-price changes block
compensation instead of being overwritten. Reasons and the compensating actor
are retained in the audit trail.

Commands covered: bids, sold/unsold, lot opening, start/pause/resume, explicit
completion, rule updates, round add/update/delete, permanent-unsold retirement,
and their automatic round/unsold-round/auction/tournament consequences. A final
sale undo reopens the actual final lot and financial state. Undo can repeat one
step at a time, including across process restarts; there is no selective undo or
redo. Auction creation, actions before this journal existed, profile edits and
presence are not reconstructable auction actions.

Transport revisions never rewind. Restored bidding pauses for review with at
least the bid-reset window available; explicit pause/resume undo restores the
lifecycle transition itself. Timer-expired bids are now rejected server-side;
expiry still never automatically decides sold/unsold.

## R6.2 — Revision-aware observation, including completed rooms

New `auction:action:recorded` / `auction:action:undone` events complement the
snapshot's `undoAction` / `lastUndoVersion`. An AsyncLocalStorage command context
stamps all cascade frames with one revision, including events produced by a
helper holding an earlier Auction instance. Publisher listeners are explicitly
owned and disposed; bounded worker-local high-watermarks and stale-timer fences
reject older work without rejecting same-revision sibling events. Snapshot
business reads share one transaction, with presence read separately.

The client fences HTTP/socket work by auction identity, connection generation
and revision. Socket `connect` always rejoins the current room, not just initial
startup. A delayed bid response never optimistically replays an already-undone
bid. HTTP and socket undo acknowledgements are deduplicated. Completed auctions
stop active bidding/ticking but **remain observed**: a legitimate later undo can
reopen them. This intentionally supersedes the original permanent terminal
seal described in Part 1.

Corrections clear pending verdicts, timers and stale celebration baselines
silently. Existing completed rounds seed the audio baseline, so the next poll
cannot replay historical applause; a truly re-completed reopened round still
celebrates exactly once. Shared confirmation dialogs move a stable portal into
and out of native fullscreen without losing the typed reason, remounting, or
breaking focus containment. Component and actual Chromium fullscreen checks
cover that transition.

## R6.3 — Running-round choice, with no queue loss

`runningAuctionRound` / `eligibleRoundPlayers` define client selection; the API
independently verifies the first nonempty unfinished round, approval, membership
and outcome inside the command transaction. The organizer may select any
eligible player there, not a later round or an unavailable player. The queue is
deduplicated and based on remaining eligibility rather than slicing after the
current array index, so selecting a later player cannot hide earlier pending
players. Engine-managed unsold-round re-listing remains supported.

## R6.4 — One optional, canonical profile link

`Player.cricHeroesUrl` is accepted by profile creation/editing and player
registration. Submission persists the canonical link in the same transaction
as registration; duplicate/failing registration cannot partially modify it.
Explicit empty edits clear the field. Projections and typed mappers carry it to
player/tournament listings, cards/queues/pools/round editor, rosters,
analytics/history/results, share/PDF layouts and 3D displays.

Both ends enforce the same host/path allowlist, HTTPS normalization, size and
credential/port checks. `CricHeroesLink` opens a safe, accessible external link
without triggering parent card selection. No scraping, embedded content or
claim of profile verification is involved. Actual create/edit form tests cover
normalization and explicit clearing, and API tests cover submission/list/snapshot
persistence. Flat registration-list types now match their real wire shape;
player rejection feedback stays private to that player.

## R6.5 — Public watching does not confer authority

Viewing routes and the shell no longer require sign-in. Server-policy,
identity/resource/status-keyed permission queries fail closed, and guests do
not fetch private policy. Management and team-console routes require actual
resource ownership, not merely an ORGANIZER role. Franchise pages and bidding
use the server's tournament-team mapping; a missing legacy `user.id` or a cached
team from another login cannot confer bidding identity. Bid controls also
require connected/live state and a positive running timer.

REST and Socket.IO share a per-tab viewer ID. One workspace-owned heartbeat
serves all auction pages and releases resources on departure. Socket joins
check auction existence, bound identity and room caps. Unjoined/mismatched
heartbeats and changing identity without leaving are rejected. Multiple sockets
sharing a tab ID retain presence until the final socket leaves. Presence remains
TTL-backed and approximate, never part of financial journal writes. Three tests
exercise actual anonymous Socket.IO clients, including real bid/undo delivery
and last-socket cleanup.

Development uses same-origin REST/socket URLs through Vite proxies, which also
works in the proxied browser preview. Production API defaults are preserved.
Browser-facing code never needs to contact the browser's own localhost.

## R6.6 — Verified outcome and honest deployment limits

The current 80-client / 43-backend automated checks and nine disposable-API
browser checks are detailed in `client/TESTING.md`. Browser acceptance includes
real owner UI bids, live guest corrections, sale/purse/roster restoration,
390px layouts, public/private-route separation and native fullscreen. Browser
profile/submission, unsold reversal and final-auction recovery were not
separately exercised; their component/API/engine regressions pass. The earlier
claim that backend integration tests could not run is superseded: a compatible
local MongoDB binary allowed real replica-set tests. A final full backend run
also exited normally with `--detectOpenHandles` and without `--forceExit`.

Deployment requires MongoDB replica-set/sharded transactions and the new model
indexes, as documented in the operator guide. There is no destructive migration
or journal backfill. Back up and retain audit headers/images together.

The deferred side-effect arrays are **not a durable distributed message
outbox**: a crash after commit can lose a broadcast. REST reconciliation is the
correctness floor. High-watermarks/timers remain worker-local; revisions fence
stale cross-worker delivery and clocks re-anchor from persisted state, but this
is not a Redis-elected timer-owner implementation. Shared MongoDB and the
existing Redis Socket.IO adapter are still required when scaling horizontally.
Large PWA bundles and 228 pre-existing TypeScript diagnostics remain technical
debt; neither a passing build nor these feature tests claims to resolve them.
