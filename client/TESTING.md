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
- **`test`** runs **80 tests across 10 files**. `test:watch` runs them
  interactively. No MongoDB, backend server, network access or login is required.
  API/socket boundaries and WebAudio devices are controlled; React, Framer
  Motion, the live store and engine reconciliation are real.
- **`build`** creates the production client and service worker. Like the
  existing build, it does **not** run TypeScript typechecking. The existing
  `.env` NODE_ENV and large-chunk warnings remain.
- **`typecheck`** invokes the installed TypeScript compiler directly. It still
  **fails**: the feature baseline had 290 diagnostics, and the final feature
  state has **228**, with no new normalized diagnostic messages (comparison
  ignores line/column shifts). This is not a fully typecheck-clean repository.
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

The backend has **43 tests across 4 suites**, including real multi-document
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

The static socket-contract gate verifies all emitted domain events are handled,
all **22** client room-event subscriptions have server publishers, and both
client join/leave commands have handlers.

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

This was not a production deployment or a committed browser CI harness.
Browser-level profile creation/submission, unsold undo and final-auction undo
were not separately exercised in that run; component/API/engine tests cover
those behaviors. Temporary browsers, tokens, fixtures and screenshots are not
shipped. Repeat this acceptance checklist against staging after deployment.

See [`docs/AUCTION_SAFETY_AND_SPECTATORS.md`](../docs/AUCTION_SAFETY_AND_SPECTATORS.md)
for workflow, API, rollout requirements and distributed-system limits.
