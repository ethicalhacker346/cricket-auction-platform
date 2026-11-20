# Numbered unsold passes: rollout and migration

This release replaces the **one unsold round per auction for its entire lifetime** constraint with **numbered history plus one unfinished pass**. Existing databases must be migrated before this backend serves auction traffic. A fresh production database also needs the replacement indexes because production uses `autoIndex: false`.

## Preconditions

- MongoDB **6.0+**, configured as a replica set or transaction-capable sharded deployment. A standalone server is not supported by the auction engine. The integration suite exercises MongoDB 6.0; verify your actual production version/topology in staging.
- A tested database backup/restore procedure and a maintenance window. Back up auction rounds, players, auctions, tournaments, teams, bids and both action-journal collections together.
- **Stop all auction writers** on every worker, including old backend versions and any administrative scripts. Do not apply while an event is running. Index construction is not a substitute for quiescing writers.
- Install the locked backend dependencies and use the new migration script. `MONGODB_URI` must identify the intended backed-up database; the script reads the environment or `backend/.env`. Do not paste credentials into chat, arguments, logs or shell history.

## Procedure

From `backend/`:

```sh
# Read-only preflight/plan. No writes are performed by default.
node scripts/migrate-unsold-passes.mjs

# Only after reviewing the plan, stopping every writer, and taking a backup:
node scripts/migrate-unsold-passes.mjs --apply

# Optional follow-up: should report zero backfills and no legacy index removals.
node scripts/migrate-unsold-passes.mjs
```

Do **not** use `Model.syncIndexes()`, `dropIndexes()` or a blanket collection rebuild. They can remove unrelated/operator indexes. Do not drop the old constraint manually before installing the replacements.

The migration:

1. Reads small unsold-round metadata in auction/order sequence, without loading player arrays or financial documents.
2. Validates every auction before any writes: at most one PENDING/ACTIVE unsold pass, positive safe-integer/nonduplicate existing pass numbers, and no conflicting replacement-index names. It stops with an error if reconciliation is required; it never guesses how to merge two unfinished passes or overwrite a custom index definition.
3. Backfills **only missing `unsoldPass` numbers**, preserving existing numbers and all other round fields. Missing numbers receive the lowest unused positive values in display order.
4. Creates these unique partial constraints **before** removing the recognized old lifetime constraint:
   - `unique_unsold_pass_number`: `(auctionId, unsoldPass)`, for unsold rounds with numeric `unsoldPass`.
   - `one_open_unsold_pass_per_auction`: `(auctionId, type)`, for unsold rounds in PENDING/ACTIVE.
5. Removes only unique indexes with exactly the old `(auctionId, type)` key and `{ type: 'unsold' }` partial predicate. A different name for that exact old definition is recognized; different/custom predicates are preserved.
6. Verifies required index definitions after `--apply`. The operation is idempotent: rerunning a completed migration makes no further metadata changes.

The report includes mode, rounds checked, number of planned backfills, exact legacy index names to remove and required index names. Review the process exit code as well as its output. If index creation fails (permissions, disk, incompatible MongoDB, or unrecognized data), keep writers stopped, diagnose the failure and rerun after correction. The script is **not one global transaction**: metadata batches or a replacement index may already have committed, but the recognized old index is not removed until both replacements have been installed. A failed run is designed to be safely rerunnable, not silently rolled back.

After applying:

- Deploy the **backend and frontend together**. The sold/unsold endpoints now require a reviewed tournament-player ID and round ID; old cached clients that send an empty body must reload. First-party controls also send `expectedVersion`. Never relax validation just to accept an old unsafe request.
- Production startup verifies both unique partial definitions and rejects the recognized old lifetime index. It exits before accepting auction traffic if constraints are not ready. This guard does not run the migration, reconstruct historical outcomes or certify database capacity/transaction topology.
- Preserve all existing application indexes, especially action headers/changes and the unique partial `(auctionId, commandId)` extension-deduplication index. This targeted script does not provision unrelated application indexes.
- Test a small staging auction: normal unsold → Unsold Round-1 → another Force Unsold → Unsold Round-2; confirm a sale/permanent retirement never reappears. Undo the final deferral and verify successor removal, every relisted player, wallet/reservation and paused recovery.
- Verify standard/3D organizer controls, owner bidding, anonymous read-only watching, live round/relist updates and refreshed snapshots. Follow `client/TESTING.md` for automated checks.

## Existing rooms and historical limitations

- Old round **names are not renamed**. Newly generated passes are named exactly `Unsold Round-1`, `Unsold Round-2`, `Unsold Round-3`, etc., using the engine-owned number independently of display order. A migrated legacy first pass can retain its earlier name while its numbered identity is shown by the progress notice.
- Migration does not change lot outcomes, current assignments, wallet/bid/roster data, auction status, transport revisions or journal history. No command is emitted and no live pass is silently advanced.
- An old running unsold pass may already have every player marked UNSOLD but no active lot. The organizer's **Continue unsold passes** action closes it and creates its successor transactionally. New passes advance on their final decision; reads/refreshes never mutate them.
- New round closures freeze aggregate `{ sold, unsold, permanentUnsold }` summaries. Legacy completed rounds without summaries remain completed with outcome totals unavailable. Mutable present-day player outcomes cannot reconstruct reliable per-player historical attempts; no such history is invented.
- Existing journal actions predate this metadata change. As with other out-of-band edits, undo may conflict with migrated/externally changed round data. Do not edit journal post-images or bypass conflict guards to force an old action through. Validate the intended recovery path in staging before resuming a migrated live room.

## Rollback

Keep the backup and previous release available, but **do not simply restart the old backend after numbered passes have been written**. It assumes lifetime uniqueness and same-pass unsold eligibility, and cannot safely operate the new history. There is intentionally no destructive automatic down-migration. Stop writers, assess any new financial/audit actions, and follow a coordinated database restore/recovery plan if rollback is necessary. Retain new data/audits needed for reconciliation; never erase an active event's transactions casually.

## Verification scope

The dedicated integration suite exercises repeat progression, concurrent commands, rollback/undo, active and waiting retirement, constraints, migration dry-run/apply/idempotency, custom-index preservation and invalid-data preflight using disposable MongoDB. The actual CLI also passed dry-run/apply/idempotency smoke checks against a separate disposable replica set. Staging rehearsal and real deployment execution remain separate: passing these checks does not mean your production database has been migrated. No live production migration is performed by the coding agent.
