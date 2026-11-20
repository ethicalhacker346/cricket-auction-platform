# Public experience, resilient media and account recovery

## What changed

The guest root is a real, responsive homepage rather than a timed opening
animation followed by a login redirect. Authenticated visitors keep their
workspace destination. Direct account, help and auction URLs no longer wait for
an introductory splash. Unknown public URLs have a genuine not-found page.

The public design uses the existing gold identity with ink-green and warm-paper
surfaces, a responsive header, native FAQ disclosures, keyboard-operated role
tabs and an explicitly **illustrative** auction preview. Preview players,
franchises and bids are examples, not live platform statistics. There are no
invented audience totals, payment/escrow claims or automatically playing media.

Shared branding, account layouts, public navigation, creator imagery, help,
contact, recovery states and legal-page navigation follow the same visual and
accessibility conventions. Auction business rules, mutation authority, financial
journals, running-round selection and numbered-pass behavior are unchanged.

## Images are enhancement, not a prerequisite

`ResilientImage` reserves its geometry and immediately renders a local fallback.
It waits for the actual load event (including already-cached images) before
revealing the image and hiding the fallback. A slow request never loses its
fallback to a timer. Failed requests remove the broken image; changed sources
start a new image lifecycle. Decorative images do not duplicate accessible
names. The wordmark and gavel mark are inline text/SVG, not network requests.

Responsive WebP assets live in `client/public/images/`:

- Gold crest: 256w **19,202 bytes**, 512w **51,436 bytes**; the original PNG was
  1,037,814 bytes. Mobile visitors need not download the original full-size file.
- Stadium: 640w / 960w / 1312w, **15,008 / 29,762 / 50,146 bytes**.
- Creator portrait: 480w / 800w / 1086w, **54,620 / 124,112 / 191,408 bytes**.
- Cricket inspiration: 480w / 736w, **42,334 / 76,616 bytes**.

The stadium is generated artwork; the crest, portrait and inspiration images
are optimized derivatives of existing repository assets. Original images still
used by other features, such as PDF exports, are not removed. Generated source
artwork, conversion dependencies and screenshots are not shipped.

## Entry graph and PWA policy

`App.tsx` keeps the homepage, brand and recovery UI in the public entry while
account pages, workspaces, auction engines, charts, PDF exporters and WebGL are
lazy routes. There is one application QueryClient provider in `main.tsx`.
The public stylesheet is scoped; auction/dashboard styling is not redesigned.

`client/scripts/public-precache.mjs` walks Vite's **static imports only**. The
service worker precaches that graph, HTML, the registration script, fonts,
favicon and manifest. Installing the homepage must not immediately download
unopened login, auction, admin, chart, PDF or Three.js routes. Hashed route
assets are cached when requested; public WebPs use a bounded runtime image
cache. API and Socket.IO navigation are excluded from the HTML fallback and
are not runtime-cached by these public policies. This is not an offline auction
or offline mutation queue.

```sh
npm --prefix client run test:precache
npm --prefix client run build
npm --prefix client run check:entry
```

`check:entry` fails when static entry JS exceeds 450 KiB raw / 150 KiB gzip,
entry CSS exceeds 85 KiB gzip, a crest exceeds 60 KiB, or unopened heavy routes
leak into the entry/precache. `npm run build` runs this gate automatically after
Vite finishes; `check:entry` can also inspect an existing build separately.
These are asset-graph budgets, not field Web Vitals or a guarantee for every
network/device. The gate reads the generated Vite manifest and service worker.

Updates are **not** automatically activated with a reload during a running
auction. A rejected lazy chunk shows explicit reload/home actions; a slow or
offline download also offers recovery. The explicit reload action checks for
a waiting/new service worker, asks it to activate, and reloads once after its
controller change, with a 2.5-second deadline if that process stalls. This
avoids repeatedly reloading an obsolete cached shell while keeping all
activation/reload decisions user-initiated. Rapid repeated recovery clicks share
one update check, activation and reload. No auction command is replayed.
If JavaScript itself cannot load, the initial HTML still has brand text,
connection advice and an accessible reload disclosure.

## Account and support contracts

- The three self-registration roles are native, labelled radio inputs. A URL
  hint can select Organizer, Franchise Owner or Player, never Administrator.
- Protected deep links retain their internal pathname, query and hash across
  sign-in/registration. Return URLs are validated; external/protocol-relative
  destinations and account-page redirect loops are rejected.
- Inputs expose stable label/error/hint associations. Password visibility is
  keyboard accessible. Button names expose only the active idle/loading label.
- Blocked/quota-limited storage permits an in-memory session. Corrupt persisted
  JSON cannot leave the app waiting forever for hydration. No second copy of
  credentials is created. Storage-disabled sessions naturally do not survive
  a full reload. Privacy-page browser-storage descriptions now name the actual
  persisted session and app caches, not the removed splash or a false claim that
  the existing session is memory-only. The ineffective Remember me checkbox
  (ignored by the existing server/store) is replaced with shared-device sign-out
  guidance; unticking a presentation-only box must not imply a private session.
  This does not change token persistence.
- Reset links are checked before showing a password form. Malformed, expired
  and used links cannot enable submission. Matching passwords must meet the
  server's complexity requirements and 8–128-character bound; registration also
  enforces the server's 128-character maximum before making a request.
  Success is announced before sign-in
  navigation, and leaving the page cancels a pending success redirect.
- End-to-end recovery testing found and fixed three existing defects: Express
  5's read-only `req.query` broke token verification; reset-token cleanup used
  Mongoose without importing it; and the client expected a nested success
  payload from an endpoint that actually returns a top-level message. Tests
  cover the real endpoint envelopes and token/password behavior. Auth debug
  logging that printed token/user payloads was removed.
- Contact **prepares an email draft** to the existing support address. It does
  not pretend to send a ticket or upload an attachment. Users review/open the
  draft in their mail app, copy it, or use the visible manual fallback.

Help-page search/filter state and FAQ expansion remain associated with the
actual question, not a changing array index. Interactive wallet examples keep
reservations/available funds nonnegative. The squad example uses one affordable
purse and squad size, with no divide-by-zero/Infinity strategy advice. These are
educational examples and do not alter real wallets or rules.

## Modal safety regression

Fast settlement/undo transitions can overlap a cinematic verdict and organizer
confirmation, or two confirmations awaiting their respective responses. Two
independent document-level focus traps could previously redirect focus to one
another synchronously and freeze the browser.

Auction dialogs/verdicts now share a small priority/portal-order focus policy:
only the uppermost modal handles focus containment and Escape. Confirmation
priority matches its existing higher visual z-index. Scroll locking is counted
across overlapping modals; closing one cannot unlock the still-open one.
Restoration targets a remaining modal before the original trigger. The real
confirmation, stale-target checks and all server mutation payloads are unchanged.
Regression tests deliberately overlap both kinds of modal instead of testing
only isolated dialogs.

## Staging checklist and limits

1. Check 320, 390, 768, 1024 and 1440px layouts, keyboard focus/skip links,
   mobile navigation/Escape, role tabs and reduced-motion behavior.
2. Hold image requests beyond the old splash lifetime, fail all images/fonts,
   and repeat with a warm browser cache. Content and primary actions must stay
   available. A completed crest must replace, not overlap, its fallback.
3. Inspect cold production requests, manifest and actual service-worker cache:
   unopened auction/admin/3D/export routes must remain deferred.
4. Test cached home offline, an unvisited offline route, a failed lazy chunk,
   an unavailable entry script, and an installed worker with a waiting update.
   Recovery must be explicit and must never replay a command or reload a live
   room automatically.
5. Use disposable accounts for registration, deep-link sign-in, blocked storage,
   valid/expired/used reset links and password-changed sign-in. Stubbing a reset
   API alone is not a substitute for the real endpoint-envelope check. Test
   actual email delivery separately against staging SMTP; it is intentionally
   stubbed for local acceptance tests.
6. Audit expanded FAQ answers and interactive help states as well as initial
   pages. Automated axe checks are useful regression coverage, not a complete
   accessibility certification or a substitute for assistive-technology testing.
7. Recheck guest read-only views, a real owner bid, organizer decisions,
   per-lot extra time, numbered passes, frozen summaries and cascade/financial
   undo across standard and immersive rooms. Overlapping dialogs must not
   compete for focus. Repeat on supported real devices/GPU drivers.

See [client testing](../client/TESTING.md) for commands and validation results.
Full-project TypeScript still has pre-existing diagnostics; a successful Vite
build does not make it typecheck-clean. Headless/local browser results are not
production capacity, SMTP, CDN or driver-matrix certification. Existing legal
policy details (operator identity, mailbox ownership, retention periods and
regulatory commitments) still require the operator's legal/operational review;
correcting the technical storage description is not legal certification.

No production migration or deployment is performed by this work. The previous
numbered-unsold-pass release still requires the coordinated migration in
[UNSOLD_PASSES_MIGRATION.md](UNSOLD_PASSES_MIGRATION.md) before its first
production rollout. For deploys, publish hashed assets before HTML/service-worker
updates and retain the previous deployment's assets during the transition so
already-open tabs can finish fetching their original chunks.
