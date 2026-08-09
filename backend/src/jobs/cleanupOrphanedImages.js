import { v2 as cloudinary } from 'cloudinary';
import { Player } from '../models/Player.js';
import { Franchise } from '../models/Franchise.js';
import { Tournament } from '../models/Tournament.js';

const FOLDER_PREFIX = process.env.CLOUDINARY_FOLDER_PREFIX || 'cricket-auction';

export async function cleanupOrphanedImages() {
  console.log(`[${new Date().toISOString()}] Starting orphan cleanup...`);

  // 1. Fetch every Cloudinary asset under our prefix
  let nextCursor = null;
  const cloudinaryIds = new Set();

  do {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: FOLDER_PREFIX,
      max_results: 500,
      next_cursor: nextCursor,
    });
    result.resources.forEach((r) => cloudinaryIds.add(r.public_id));
    nextCursor = result.next_cursor;
  } while (nextCursor);

  // 2. Fetch all valid publicIds from MongoDB
  const [players, franchises, tournaments] = await Promise.all([
    Player.find({ profileImagePublicId: { $exists: true } })
      .select('profileImagePublicId')
      .lean(),
    Franchise.find({ logoPublicId: { $exists: true } })
      .select('logoPublicId')
      .lean(),
    Tournament.find({ logoPublicId: { $exists: true } })
      .select('logoPublicId')
      .lean(),
  ]);

  const validIds = new Set([
    ...players.map((p) => p.profileImagePublicId),
    ...franchises.map((f) => f.logoPublicId),
    ...tournaments.map((t) => t.logoPublicId),
  ]);

  // 3. Destroy orphans
  const orphans = [...cloudinaryIds].filter((id) => !validIds.has(id));
  if (orphans.length === 0) {
    console.log('[Cleanup] No orphans found.');
    return;
  }

  console.log(`[Cleanup] Found ${orphans.length} orphaned assets.`);

  const results = await Promise.allSettled(
    orphans.map((id) => cloudinary.uploader.destroy(id, { invalidate: true }))
  );

  const deleted = results.filter(
    (r) => r.status === 'fulfilled' && r.value.result === 'ok'
  ).length;

  console.log(`[Cleanup] Deleted ${deleted}/${orphans.length} assets.`);
}