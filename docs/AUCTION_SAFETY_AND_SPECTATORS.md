# Auction operations, resilience, and public watching

## Organizer workflow

### Undo the latest action

Open **Live Auction → Organizer safety net → Undo latest** (also available in the immersive room's organizer panel). Review the exact action, optionally record a reason, and confirm. The audit trail lists recent applied/undone actions. Repeat to walk backward one action at a time; arbitrary selective undo and redo are intentionally not offered.

The journal covers new auction commands:

- Any team owner's bid, including restoring the previous leader and wallet reservation.
- Sold/unsold decisions, restoring the player, roster, purse, and winning bid together.
- Opening a lot; start, pause, resume, and explicit completion.
- Rule changes and adding, editing, or deleting a round.
- Permanent-unsold decisions in the unsold round.
- Automatic consequences of these commands: round closure, unsold-round creation/player reset, and auction/tournament completion. Undoing a final sale therefore reopens the final lot, not just its visual card.

A recovered bidding lot **pauses for organizer review**, with at least the configured bid-reset window remaining. Explicitly resume before bidding again. Undoing Pause/Resume restores that lifecycle transition instead. Cancelled bids remain in bid history and the live feed, labelled and excluded from bid analytics. Profile/presence changes are not auction commands and are never rolled back. Creation and actions predating this journal are not reconstructable.

Confirmations are latest-action-first. A newer bid/action disables an already-open undo confirmation; the API independently checks the exact latest action ID. Changed related business data (for example an externally edited wallet or changed player approval/base price) causes a **409 conflict**, not a blind overwrite. Refresh, review, and reconcile that change rather than retrying an old confirmation. There is no forced-undo override.

### Choose the next player

Under **Next on the floor**, search and select any eligible member of the running round, then choose **Open Next Lot**. The first eligible player remains the default. The running round is the active round, otherwise the first nonempty pending round by order. Later rounds remain locked until it is resolved. Sold, permanently unsold, unavailable, and other-round players cannot be selected. An active lot must be settled first. The API rechecks membership, approval, eligibility, and round order transactionally; editing a client request cannot bypass it.

The upcoming queue retains earlier pending players when a later player is chosen. Eligible unsold players remain available in the engine-managed unsold round.

### Give the current player extra time

In the standard room's **Auction controls**, or the immersive room's **Control → Organizer console**, use **Extra time — This lot only**. Choose **+10s**, **+30s**, **+60s**, or enter **5–300 whole seconds**. The panel names the current player and remains available after the countdown ends.

- In a **LIVE** auction, time is added to the actual unelapsed remainder, or to zero after expiry. Owners may bid again immediately when the extension commits. The existing winning bid and wallet reservations are preserved.
- In a **PAUSED** auction, extra time is saved but stays frozen. Choose **Resume** when ready; an extension never resumes the auction implicitly.
- Only the active, unsettled **BIDDING** lot can be extended. A settled player must not be reopened by adding time. A delayed request for a different player is rejected.
- This does **not** edit the global lot/bid-reset rules. The next lot starts with its normal configured duration. The current lot's timer dial accounts for its extensions; remaining time is capped at one hour.
- The extension is recorded in the action journal and can be undone using the same latest-action-first safety net. Undoing an active bidding command pauses for review, as described above.

If a connection times out, the panel offers **Retry this extension safely** and reuses the same request ID. The API deduplicates an identical request; it cannot add time twice. It rejects a reused ID with changed input or an already-undone command. Mutation requests are never automatically replayed. After leaving/reloading the page, review the current clock and audit trail before issuing a new extension.

## Player CricHeroes links

The optional **CricHeroes profile link** field is available in create/edit profile and tournament submission. Submission saves the link on the canonical Player atomically with registration; a failed registration does not partially edit the profile. Emptying the edit field explicitly removes it.

Links propagate through tournament player listings, live cards, queue, pool/round editor, team rosters, history, dashboard, results, analytics, share/PDF layouts, and immersive-room player displays. Existing players without links need no migration.

Both API and UI allow only official `.com`/`.in` player-profile URLs (including `www`) or query-free `cricheroes.page.link` tokens. HTTP is normalized to HTTPS; credentials, nondefault ports, oversized/control-character input and unrelated hosts/paths are rejected. Links open separately with `noopener noreferrer`, never as embeds or fetched/scraped statistics. They are **self-supplied external profiles**, not verified records. Rejection feedback in registration lists is visible only to that player, not public spectators.

## Guests and permissions

Share the live room's **Share watch link**. No account is required for the live/3D room, auction dashboard, history, analytics, and results. Guests receive the same public room events, corrections, timers and verdicts as signed-in spectators. The banner identifies this as read-only and offers sign-in.

Guests cannot bid, undo, configure auctions, manage rounds, or open a team console. Unrelated signed-in organizers remain spectators for auctions they do not own. Client navigation and route guards fail closed, but REST authorization remains authoritative. WebSockets expose observation/presence, not bidding or administrative mutation handlers. Bidding identity is resolved from this auction's server permissions, never a previously cached team or optional legacy `user.id`.

A per-tab opaque viewer identity is shared by the socket and REST heartbeat, avoiding double counting. The workspace owns one heartbeat and releases the connection on departure. Presence uses a separate TTL-backed collection rather than contending with financial writes. Counts are ephemeral/approximate across connection loss; they are not financial state.

## Traffic protection without interrupting the auction

The former blanket API/IP allowance let snapshot reads and presence heartbeats exhaust the same budget as organizer actions and bidding. Live traffic now has independent scopes, and authenticated callers are bucketed by a **cryptographically verified access-token subject**, not an untrusted user/team/viewer ID. Bucket selection does not grant authorization; normal authentication and transactional permissions still apply. Anonymous spectators share generous IP-based read/presence allowances suitable for a venue NAT.

Default production budgets are:

| Scope | Allowance | Identity |
|---|---|---|
| Ordinary API / unknown routes | 200 / 15 minutes | Verified account, otherwise client IP |
| Recognized auction reads | 1,200 / minute | Verified account |
| Anonymous auction reads | 12,000 / minute | Client IP |
| Viewer heartbeat/leave | 12,000 / minute | Verified account, otherwise client IP |
| Organizer commands | 180 / minute | Verified account, otherwise client IP; authorization still required |
| Bid ingress | 600 / minute | Verified account, otherwise client IP; authorization still required |
| Authenticated bid burst | 8 / 2 seconds | Actual authenticated owner `_id` |

Only exact method/path matches receive live allowances. Reads and presence cannot consume bid/command allowances, and unrelated/unknown routes remain protected. Under `NODE_ENV=development`, ordinary/live budgets are multiplied by 20 and the bid burst is 80 / 2 seconds. Authentication, password-reset and upload protections are **not** relaxed. These are abuse limits, not an unlimited-traffic guarantee or a measured capacity claim.

A real limit returns HTTP **429** with `code: "RATE_LIMITED"`, `scope`, `retryAfter` seconds, and a CORS-exposed `Retry-After` header. The auction client coalesces concurrent snapshot reads, respects that deadline with jittered backoff, and does not mark a healthy socket disconnected because an HTTP read was throttled. Presence prefers the joined socket, with one sequential REST fallback; hidden pages stop heartbeat work. Extension/bid/other mutation requests are not automatically retried.

### Proxy, Redis, and socket deployment

- Set `TRUST_PROXY_HOPS` to the **exact trusted ingress hop count**, from 0 to 8; the default is 0 for direct access. Both Express and Socket.IO use the same boundary. Never enable indiscriminate forwarded-IP trust. Ensure clients cannot bypass that ingress via a shorter path; a numeric hop count assumes a known, uniform proxy topology.
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUCTION_READ_RATE_LIMIT_MAX`, `AUCTION_GUEST_RATE_LIMIT_MAX`, and `AUCTION_COMMAND_RATE_LIMIT_MAX` configure the corresponding HTTP budgets. See `backend/.env.example`.
- Set the same `REDIS_URL` on all API workers for atomic shared counters and the Socket.IO Redis adapter. Counters use separate namespaced scopes. Without Redis, protection remains worker-local; during an outage, warm bounded local counters prevent a fresh allowance on each failed remote request. Command deadlines and a short circuit-breaker cooldown keep a half-open Redis connection from delaying every bid. Degraded operation is logged with warning throttling.
- Socket admission distinguishes **reconnection attempts** from **active leases**. Defaults are 2,000 concurrent sockets per IP (`SOCKET_MAX_CONNECTIONS_PER_IP`) and 8 per signed-in account, plus per-minute attempt bounds. Active leases survive minute boundaries and release idempotently on disconnect. These admission counts are **worker-local**, not distributed occupancy limits.
- Socket Redis startup is bounded; unavailable Redis cannot hang API startup. Offline queues are disabled, publishing failures are observed, and same-worker delivery continues. If Redis is unavailable at initial startup, that worker uses the local adapter until restart. During a later outage of an attached adapter, cross-worker frames may be lost until reconnect; authoritative REST reconciliation remains necessary. Do not assume Redis degradation gives uninterrupted cross-worker realtime delivery.

Monitor 429 counts by scope, Redis-degraded warnings, event-loop lag, MongoDB transaction latency and socket counts. Size/test the deployment against expected audience and bid rates before an event; the test suite is not a production load test. More permissive live allowances do not replace ingress connection/body limits or DDoS protection.

## Immersive room operation

Open **Display settings** from the immersive toolbar on desktop or mobile:

- Choose **Auto**, **Performance**, **Balanced**, or **Cinematic** rendering. Auto starts from device/memory/data-saver hints, then uses sustained FPS samples and hysteresis instead of oscillating after a single slow frame. Pixel ratio, shadows and atmospheric detail have explicit budgets.
- Choose Broadcast, Stage, Top, Floor, or Free orbit. One-finger drag and two-finger pinch work in orbit; trackpad swipes rotate/tilt. Labelled step-by-step controls provide a keyboard/touch alternative to dragging. Manual orbit input temporarily suppresses automatic bid-follow cuts.
- Pause decorative motion, disable bid-follow camera cuts, or change auction audio independently. Device reduced-motion preferences are respected and react to changes. These settings affect this screen, never the financial state or live clock; storage failures do not disable in-session controls.
- The scene stops rendering while hidden or graphics are lost, and renders on demand with motion paused/reduced. Only 12 teams occupy the 3D stage at once, always retaining the current leader. The searchable queue is paginated at 40 entries; full team/queue data remains available in the console.
- A graphics reset leaves the **live engine, bid dock, and organizer controls mounted**. Native context restoration enters safe quality; after eight seconds without restoration, an explicit **Restart visual stage** retries only the renderer. WebGL 2-unavailable devices retain the console and an **Open standard room** fallback.

Scene labels are isolated below interactive HUD controls, and drawers/dock are sized relative to the room rather than the whole browser. The Three.js renderer remains lazy-loaded and is excluded from PWA precaching, so ordinary 2D viewers do not download it in the background. The service worker does not substitute the app shell for API/Socket.IO navigation. These bounds reduce client cost but do not eliminate the existing large application bundle.

## API / event additions

- `GET /api/v1/auctions/:auctionId/actions`: authorized organizer/admin; latest 30 audit headers, without internal pre/post-images.
- `POST /api/v1/auctions/:auctionId/undo`: authorized organizer/admin; `{ "actionId": "<exact latest ID>", "reason": "optional, at most 500 characters" }`.
- `POST /api/v1/auctions/:auctionId/lot/time`: owning organizer/admin with `EXTEND_LOT_TIME`, while LIVE/PAUSED; strict body `{ "tournamentPlayerId": "<active tournament-player ID>", "seconds": 30, "requestId": "<UUID>" }`. Returns the current authoritative `liveState` and elapsed-adjusted `timer`; an identical retry returns the current clock, not the original duration. Reused/undone IDs return `409 COMMAND_ALREADY_USED`.
- Permission policy version 5 adds `EXTEND_LOT_TIME` / `canExtendLotTime`. Guests and unrelated organizers gain no mutation authority.
- Snapshots expose `undoAction` and `lastUndoVersion` alongside monotonic `version`. Optional `liveState.timerTotalSeconds` is per-lot; older lots fall back to configured duration.
- Room events: `auction:action:recorded`, `auction:action:undone`, and `auction:lot:time:extended`; all command cascade events carry their command revision. The extension carries player ID, seconds, status and authoritative live state, and restarts/stops the publisher clock according to LIVE/PAUSED status.
- Optional `cricHeroesUrl` on Player create/update and player-registration submission; public player projections include it.
- Existing open-lot endpoint accepts an explicit eligible tournament-player ID and running-round ID. Team IDs submitted with bids never confer ownership.

## Integrity and deployment

**MongoDB replica-set/sharded transactions are required**, as they already are for bidding. A standalone MongoDB cannot support this implementation. No destructive data migration or journal backfill is performed. Deploy the new models/indexes through the repository's normal Mongoose index-management process, including the action-history index, the unique action-change index, and the new **unique partial `(auctionId, commandId)` index** on action headers. The latter is required for concurrent extension deduplication; legacy headers without a command ID do not need backfilling. Take the normal database backup before rollout. Back up/retain `AuctionAction` and `AuctionActionChange` together; deleting journal images while keeping an active head would invalidate undo.

Every command rebuilds authorization within a transaction and writes the Auction as a serialization fence. Pre/post-images are field-scoped and stored per resource in `AuctionActionChange`, not as a growing embedded undo stack. Audit headers are separate; profiles/user credentials and live presence are excluded. All post-images are validated before any compensation writes, wallet invariants remain enforced, and transport revisions never rewind.

Snapshot business reads share one committed transaction; presence is read outside it. Client generation/auction fences prevent cross-room HTTP results, older socket events, and delayed undo acknowledgements from overwriting newer state. Completed rooms remain observable so a final-sale undo can recover them. Corrections clear verdicts and seed a silent audio/round baseline; later genuine round completions still celebrate.

Domain publications and notifications are deferred until commit, and notifications do not delay realtime publication. This is a **post-commit in-process queue, not a durable external message outbox**. A process crash can lose a broadcast; authoritative REST reconciliation/reconnect repairs clients. Publisher revision high-watermarks are worker-local and bounded; client revision fences also apply across Redis-adapter delivery. Timers re-anchor from persisted remaining time/updated time and do not independently mutate settlement. Horizontal production deployments still require the existing shared MongoDB replica set and Socket.IO Redis adapter.

During development, REST and Socket.IO default to same-origin URLs proxied by Vite to `DEV_API_TARGET` (default `http://127.0.0.1:3000`, server-side only). This works in a proxied browser preview without asking the browser to contact its own localhost. Production retains the existing API origin unless `VITE_API_BASE_URL` / `VITE_SOCKET_URL` are configured. Vite binds publicly and accepts the preview host suffix; backend production origin policy is not broadened.

## Verification

Repeatable commands are in `client/TESTING.md`. The backend feature suite uses a real ephemeral MongoDB replica set, not mocked transactions; socket tests use an actual HTTP/Socket.IO server and anonymous client. Tests cover financial compensation, stale/repeated confirmation, simultaneous bids/undo, transaction abort/no leaked events, automatic completion/unsold-round reversal, running-round eligibility, profile validation/persistence/clearing, public reads/denied mutations, publisher/timer cleanup and client reconciliation.

The final follow-up passes **125 frontend tests, 69 backend tests, five real-Redis integration checks**, hooks lint, the 23-event socket contract, syntax/diff checks and a production PWA build. Full-project typecheck still fails with the same **228 pre-existing diagnostics**; bundle-size warnings also remain.

One-off Chromium checks additionally exercise real organizer/owner/anonymous browser sessions against that disposable API: arbitrary player selection, UI bidding, bid and sale undo across tabs, private-route redirects, public read pages, guest 3D viewing, and confirmation portal/focus continuity across native fullscreen exit. The follow-up targeted harness exits successfully with eight checks and no uncaught exceptions: real expired-lot rejection/extension/bidding, paused extensions, both organizer views, 320px/390px settings and camera controls, native WebGL context recovery without socket loss, actual HTTP 429 backoff with continuing socket updates, and no-WebGL fallback. This is not a production capacity/failover certification. Temporary databases, tokens, browsers, screenshots and demo data are not shipped.
