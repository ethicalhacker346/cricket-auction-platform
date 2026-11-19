# Auction safety, profile links, and public watching

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

## Player CricHeroes links

The optional **CricHeroes profile link** field is available in create/edit profile and tournament submission. Submission saves the link on the canonical Player atomically with registration; a failed registration does not partially edit the profile. Emptying the edit field explicitly removes it.

Links propagate through tournament player listings, live cards, queue, pool/round editor, team rosters, history, dashboard, results, analytics, share/PDF layouts, and immersive-room player displays. Existing players without links need no migration.

Both API and UI allow only official `.com`/`.in` player-profile URLs (including `www`) or query-free `cricheroes.page.link` tokens. HTTP is normalized to HTTPS; credentials, nondefault ports, oversized/control-character input and unrelated hosts/paths are rejected. Links open separately with `noopener noreferrer`, never as embeds or fetched/scraped statistics. They are **self-supplied external profiles**, not verified records. Rejection feedback in registration lists is visible only to that player, not public spectators.

## Guests and permissions

Share the live room's **Share watch link**. No account is required for the live/3D room, auction dashboard, history, analytics, and results. Guests receive the same public room events, corrections, timers and verdicts as signed-in spectators. The banner identifies this as read-only and offers sign-in.

Guests cannot bid, undo, configure auctions, manage rounds, or open a team console. Unrelated signed-in organizers remain spectators for auctions they do not own. Client navigation and route guards fail closed, but REST authorization remains authoritative. WebSockets expose observation/presence, not bidding or administrative mutation handlers. Bidding identity is resolved from this auction's server permissions, never a previously cached team or optional legacy `user.id`.

A per-tab opaque viewer identity is shared by the socket and REST heartbeat, avoiding double counting. The workspace owns one heartbeat and releases the connection on departure. Presence uses a separate TTL-backed collection rather than contending with financial writes. Counts are ephemeral/approximate across connection loss; they are not financial state.

## API / event additions

- `GET /api/v1/auctions/:auctionId/actions`: authorized organizer/admin; latest 30 audit headers, without internal pre/post-images.
- `POST /api/v1/auctions/:auctionId/undo`: authorized organizer/admin; `{ "actionId": "<exact latest ID>", "reason": "optional, at most 500 characters" }`.
- Snapshots expose `undoAction` and `lastUndoVersion` alongside monotonic `version`.
- Room events: `auction:action:recorded` and `auction:action:undone`; all command cascade events carry their command revision.
- Optional `cricHeroesUrl` on Player create/update and player-registration submission; public player projections include it.
- Existing open-lot endpoint accepts an explicit eligible tournament-player ID and running-round ID. Team IDs submitted with bids never confer ownership.

## Integrity and deployment

**MongoDB replica-set/sharded transactions are required**, as they already are for bidding. A standalone MongoDB cannot support this implementation. No destructive data migration or journal backfill is performed. Deploy the new models/indexes through the repository's normal Mongoose index-management process, including the action-history index and the unique action-change index. Take the normal database backup before rollout. Back up/retain `AuctionAction` and `AuctionActionChange` together; deleting journal images while keeping an active head would invalidate undo.

Every command rebuilds authorization within a transaction and writes the Auction as a serialization fence. Pre/post-images are field-scoped and stored per resource in `AuctionActionChange`, not as a growing embedded undo stack. Audit headers are separate; profiles/user credentials and live presence are excluded. All post-images are validated before any compensation writes, wallet invariants remain enforced, and transport revisions never rewind.

Snapshot business reads share one committed transaction; presence is read outside it. Client generation/auction fences prevent cross-room HTTP results, older socket events, and delayed undo acknowledgements from overwriting newer state. Completed rooms remain observable so a final-sale undo can recover them. Corrections clear verdicts and seed a silent audio/round baseline; later genuine round completions still celebrate.

Domain publications and notifications are deferred until commit, and notifications do not delay realtime publication. This is a **post-commit in-process queue, not a durable external message outbox**. A process crash can lose a broadcast; authoritative REST reconciliation/reconnect repairs clients. Publisher revision high-watermarks are worker-local and bounded; client revision fences also apply across Redis-adapter delivery. Timers re-anchor from persisted remaining time/updated time and do not independently mutate settlement. Horizontal production deployments still require the existing shared MongoDB replica set and Socket.IO Redis adapter.

During development, REST and Socket.IO default to same-origin URLs proxied by Vite to `DEV_API_TARGET` (default `http://127.0.0.1:3000`, server-side only). This works in a proxied browser preview without asking the browser to contact its own localhost. Production retains the existing API origin unless `VITE_API_BASE_URL` / `VITE_SOCKET_URL` are configured. Vite binds publicly and accepts the preview host suffix; backend production origin policy is not broadened.

## Verification

Repeatable commands are in `client/TESTING.md`. The backend feature suite uses a real ephemeral MongoDB replica set, not mocked transactions; socket tests use an actual HTTP/Socket.IO server and anonymous client. Tests cover financial compensation, stale/repeated confirmation, simultaneous bids/undo, transaction abort/no leaked events, automatic completion/unsold-round reversal, running-round eligibility, profile validation/persistence/clearing, public reads/denied mutations, publisher/timer cleanup and client reconciliation.

One-off Chromium checks additionally exercise real organizer/owner/anonymous browser sessions against that disposable API: arbitrary player selection, UI bidding, bid and sale undo across tabs, private-route redirects, public read pages, 390px layouts, guest 3D viewing, and confirmation portal/focus continuity across native fullscreen exit. Temporary databases, tokens, browsers, screenshots and demo data are not shipped.
