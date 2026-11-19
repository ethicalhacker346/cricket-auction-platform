# Auction regression and integration checks

## Client

From `client/`, install locked dependencies and run:

```sh
npm ci
npm run lint:hooks
npm test
npm run build
npm run typecheck
```

- **`lint:hooks`** checks hook ordering in every `src/**/*.ts` and `.tsx` file,
  including hooks hidden below early returns. It uses a dedicated configuration
  because the legacy default ESLint configuration only includes JavaScript.
- **`test`** runs **125 tests across 18 files**. `test:watch` runs them
  interactively. No MongoDB, backend server, network access or login is required.
  API/socket boundaries and WebAudio devices are controlled; React, Framer
  Motion, the live store and engine reconciliation are real.
- **`build`** creates the production client and service worker. Like the
  existing build, it does **not** run TypeScript typechecking. The existing
  `.env` NODE_ENV and large-chunk warnings remain.
- **`typecheck`** invokes the installed TypeScript compiler directly. It still
  **fails**: the earlier feature baseline had 290 diagnostics, and both the
  committed feature state and this resilience follow-up have **228**. The
  follow-up adds no new semantic diagnostics (comparison ignores line/column
  shifts and the ordering of equivalent union members in compiler messages).
  This is not a fully typecheck-clean repository.
  Do not mistake filtered compiler output or a successful Vite build for a
  successful full-project typecheck.

### Coverage

- Hook order across lot transitions, image fallbacks, fresh vs historical
  verdicts, event deduplication and auction-context changes.
- Cross/Escape/backdrop/automatic dismissal, parent clock updates, consecutive
  verdicts and stale callbacks, focus/scroll restoration, native-fullscreen
  portal lifecycle, sound cancellation/mute, unavailable audio/storage and
  StrictMode resource cleanup.
- Running-round selection and invalidated selections, preserved pending queue,
  unsold-round eligibility, stale-action confirmation and pending undo guards.
- Undo arriving before a delayed bid response, duplicate HTTP/socket undo,
  out-of-order revisions, cross-auction response fencing, reconnect room joins,
  completed-auction recovery, silent audio correction and genuine later round
  re-completion.
- Guest/unrelated-organizer access, private-route guards, fail-closed permission
  changes on account/auction switch, canonical `_id` owner-console mapping,
  authoritative bidding identity and connectivity/timer gating.
- CricHeroes URL allowlist, safe accessible external links, click propagation,
  actual create/edit profile form submission and explicit link clearing.
- Snapshot request coalescing, Retry-After parsing, jittered backoff without
  suppressing live socket events, and bounded/cancelled API requests.
- Per-lot extra-time controls in LIVE/PAUSED/expired states, safe same-ID retry
  after an uncertain outcome, authoritative HTTP clocks, and generation/revision
  fencing against stale responses.
- Device/FPS quality budgets and hysteresis, stage capacity with leader retention,
  consistent CSS/Three.js colors, settings persistence/storage failures, live
  reduced-motion preference changes, accessible searchable/paginated HUD panels,
  and renderer-only native recovery/restart without losing the live console.

Most animation tests skip decorative keyframe duration for determinism.
`SoldUnsoldAnimation.motion.test.tsx` deliberately runs real entrance/exit
animations on real timers in an isolated module graph. It asserts physical DOM
removal, not merely `aria-hidden`, to catch invisible overlays. Unexpected React
console errors fail tests even when an error boundary catches the exception.

## Backend and cross-layer contract

From the repository root:

```sh
npm --prefix backend ci
npm --prefix backend test
node backend/scripts/verify-socket-contract.mjs
git diff --check
```

The backend has **69 tests across 5 suites**, including real multi-document
transactions and actual anonymous Socket.IO connections. `tests/helpers.js`
starts a one-node **replica set**, initializes model indexes, and tears down the
process after each suite. A standalone MongoDB is not a valid substitute for
transaction tests. SMTP startup verification is disabled under `NODE_ENV=test`;
no external email service is contacted.

`mongodb-memory-server` normally downloads its MongoDB binary. In an offline or
allowlisted runner, provide a **trusted, compatible** local `mongod`:

```sh
MONGOMS_SYSTEM_BINARY=/path/to/mongod npm --prefix backend test
```

If the binary differs from memory-server's default requested version, set
`MONGOMS_VERSION` to match it (or explicitly disable its version check only when
that compatibility is intentional). Required shared libraries must also be
available. Do not commit downloaded binaries, temporary databases or credentials.

The final run also passes **without** the package script's legacy `--forceExit`,
with open-handle detection enabled. From `backend/`:

```sh
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  --runInBand --detectOpenHandles
```

Backend coverage includes complete bid/sale/unsold compensation, wallet/roster
invariants, repeated/stale/concurrent undo, completion/unsold-round cascades,
round CRUD/rules/lifecycle reversal, denied unsafe external edits, transaction
abort with no premature emissions, running-round eligibility, profile
validation/persistence/projections/clearing, private rejection feedback, public
reads and denied mutations. Publisher tests cover revisions, clock anchoring,
listener/timer disposal and undo correction. Actual socket tests cover guest
join/live updates, missing-auction rejection, bound identities, shared-viewer
last-socket cleanup and no administrative mutation handlers.

Additional backend regressions cover expired/paused/live extensions, one-lot
isolation, stale player rejection, permissions/input bounds, concurrent/same-ID
requests, changed/undone-ID conflicts, audit-failure rollback/no emission and
undo compensation. Traffic tests exercise production-style scopes, venue NATs,
forged identities/untrusted forwarding headers, development allowances, real
bid-burst isolation, bounded outage fallback, half-open Redis circuit breaking,
socket leases, and bounded native-Redis startup/publish-failure cleanup.

The static socket-contract gate verifies all emitted domain events are handled,
all **23** client room-event subscriptions have server publishers, and client
join/leave/heartbeat commands have handlers. Syntax checks can also be run with:

```sh
find backend/src backend/scripts \( -name '*.js' -o -name '*.mjs' \) -print0 \
  | xargs -0 -n1 node --check
```

### Opt-in real Redis verification

Use a **disposable** Redis instance, not an application or production database:

```sh
RATE_LIMIT_TEST_REDIS_URL=redis://127.0.0.1:6389/15 \
  node backend/scripts/verify-rate-limit-redis.mjs
```

All five checks pass against Redis 7.2.6: independent workers' shared atomic
counters/scope isolation; warm local fallback after actual disconnect; reconnect
with decrement/reset; real window expiry; and native node-redis pub/sub delivery.
The script uses a random key prefix and targeted cleanup, never `FLUSHDB` or
`SCRIPT FLUSH`. The unit suite separately covers stalled startup and failed
publishing. These checks do not certify infrastructure failover, distributed
socket admission, or production audience capacity.

After building, inspect the generated `dist/sw.js`: it must not include an
`AuctionArena3D-*.js` precache entry. The final build has **14 entries / 3602.20
KiB**, excluding the lazy renderer; `.env` and large-chunk warnings still remain.

## Real-browser acceptance checks

A one-off Chromium run against a **disposable replica-set API**, with separate
organizer/owner/anonymous sessions, passed these nine checks:

1. Guests have read-only controls; the owner console resolves canonical IDs.
2. The organizer selects an arbitrary running-round player; guests receive the
   real opened lot and CricHeroes card link.
3. A real owner UI bid is undone across sessions, becomes cancelled in history,
   and recovered bidding pauses.
4. Sale undo clears verdicts and restores the paused lot, winning bid, purse and
   roster atomically.
5. Guest live view and organizer undo dialog fit a 390px viewport without
   horizontal overflow.
6. Read-only pages are public; management URLs reject guests and unrelated
   organizers.
7. Mobile guests can watch the immersive room without organizer controls or an
   enabled bid action.
8. A typed undo reason and contained focus survive native 3D fullscreen exit.
9. No uncaught browser exceptions occur in those flows.

A further targeted Chromium run for this follow-up completed successfully with
**eight checks and no uncaught browser exceptions**:

1. A real five-second lot expires and an owner bid returns 409; the standard
   organizer's +30s extension reopens that same player for a real owner UI bid,
   without changing the global five-second lot rule.
2. Extra time added while paused stays frozen; pending/success messages identify
   the active player.
3. Real mobile WebGL 2 rendering, persisted camera presets, step-by-step orbit
   and motion controls work; 320px/390px room and bid dock do not overflow.
4. Native WebGL loss/restoration keeps the live socket and spectator console
   intact and enters safe quality on recovery.
5. The 3D organizer panel extends a paused lot, and Resume reopens its clock.
6. An intercepted real HTTP 429 with `Retry-After: 30` coalesces repeated refresh
   requests while a subsequent real server/socket extension arrives immediately.
7. With WebGL 2 explicitly unavailable, the console remains mounted with an
   accessible standard-room fallback.
8. No uncaught browser exceptions occur across these flows.

These were disposable-API acceptance runs, not production deployments, load
benchmarks, or a committed browser CI harness. Native context restoration and
simulated WebGL unavailability were exercised; real driver/OS/device failure
matrices were not. Browser-level profile creation/submission, unsold undo and
final-auction undo were not separately exercised; component/API/engine tests
cover those behaviors. Temporary browsers, tokens, fixtures and screenshots are
not shipped. Repeat both acceptance checklists against staging after deployment.

See [`docs/AUCTION_SAFETY_AND_SPECTATORS.md`](../docs/AUCTION_SAFETY_AND_SPECTATORS.md)
for workflow, API, rollout requirements and distributed-system limits.
