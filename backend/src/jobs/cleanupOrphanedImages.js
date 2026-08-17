/**
 * jobs/cleanupOrphanedImages.js — Production-grade Cloudinary cleanup
 * -------------------------------------------------------------------
 * • Distributed locking
 * • Batch processing with rate limiting
 * • Age filtering (24h grace period)
 * • Structured logging with metrics
 * • Retry logic per batch
 * • Memory-safe (no Promise.all on 10k items)
 */

import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../config/logger.js';
import { withDistributedLock } from '../utils/distributedLock.js';
import { Player } from '../models/Player.js';
import { Franchise } from '../models/Franchise.js';
import { Tournament } from '../models/Tournament.js';

const FOLDER_PREFIX = process.env.CLOUDINARY_FOLDER_PREFIX || 'cricket-auction';
const BATCH_SIZE = 50;
const MIN_AGE_HOURS = 24;
const BATCH_DELAY_MS = 1000;
const MAX_RETRIES = 3;

export async function cleanupOrphanedImages() {
  return withDistributedLock('cleanup-orphaned-images', 3600, async () => {
    const jobLogger = logger.child({ job: 'cleanupOrphanedImages' });
    const startTime = Date.now();
    
    jobLogger.info('🧹 Starting orphan cleanup job');

    try {
      const cloudinaryIds = new Map();
      let nextCursor = null;
      let pageCount = 0;

      do {
        pageCount++;
        const result = await cloudinary.api.resources({
          type: 'upload',
          prefix: FOLDER_PREFIX,
          max_results: 500,
          next_cursor: nextCursor,
        });

        result.resources.forEach((resource) => {
          const uploadedAt = new Date(resource.created_at);
          const ageHours = (Date.now() - uploadedAt.getTime()) / (1000 * 60 * 60);
          
          if (ageHours > MIN_AGE_HOURS) {
            cloudinaryIds.set(resource.public_id, uploadedAt);
          }
        });

        nextCursor = result.next_cursor;
        jobLogger.debug({ page: pageCount, fetched: result.resources.length }, 'Fetched Cloudinary page');
      } while (nextCursor);

      jobLogger.info({ totalAssets: cloudinaryIds.size, pages: pageCount }, 'Cloudinary assets fetched');

      if (cloudinaryIds.size === 0) {
        return { scanned: 0, deleted: 0, failed: 0, skipped: 0, durationMs: Date.now() - startTime };
      }

      const [players, franchises, tournaments] = await Promise.all([
        Player.find({ profileImagePublicId: { $exists: true, $ne: null } })
          .select('profileImagePublicId')
          .lean()
          .maxTimeMS(30000),
        Franchise.find({ logoPublicId: { $exists: true, $ne: null } })
          .select('logoPublicId')
          .lean()
          .maxTimeMS(30000),
        Tournament.find({ logoPublicId: { $exists: true, $ne: null } })
          .select('logoPublicId')
          .lean()
          .maxTimeMS(30000),
      ]);

      const validIds = new Set([
        ...players.map((p) => p.profileImagePublicId),
        ...franchises.map((f) => f.logoPublicId),
        ...tournaments.map((t) => t.logoPublicId),
      ]);

      jobLogger.info({ validCount: validIds.size }, 'Valid IDs loaded from database');

      const orphans = [];
      for (const [publicId] of cloudinaryIds) {
        if (!validIds.has(publicId)) {
          orphans.push(publicId);
        }
      }

      if (orphans.length === 0) {
        jobLogger.info('✅ No orphaned assets found');
        return { scanned: cloudinaryIds.size, deleted: 0, failed: 0, skipped: 0, durationMs: Date.now() - startTime };
      }

      jobLogger.info({ orphanCount: orphans.length }, 'Orphaned assets identified');

      let deleted = 0;
      let failed = 0;
      let notFound = 0;

      for (let i = 0; i < orphans.length; i += BATCH_SIZE) {
        const batch = orphans.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(orphans.length / BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (publicId) => {
            let lastError = null;
            
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
              try {
                const result = await cloudinary.uploader.destroy(publicId);
                
                if (result.result === 'ok') return { publicId, status: 'deleted' };
                if (result.result === 'not found') return { publicId, status: 'not_found' };
                throw new Error(`Unexpected result: ${result.result}`);
              } catch (err) {
                lastError = err;
                if (attempt < MAX_RETRIES) {
                  await new Promise((r) => setTimeout(r, 500 * attempt));
                }
              }
            }
            
            throw lastError;
          })
        );

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            if (result.value.status === 'deleted') deleted++;
            else if (result.value.status === 'not_found') notFound++;
          } else {
            failed++;
            jobLogger.error({ err: result.reason, publicId: result.reason?.publicId }, 'Failed to delete asset after retries');
          }
        });

        jobLogger.debug({ 
          batch: `${batchNum}/${totalBatches}`, 
          deleted, 
          failed, 
          notFound 
        }, 'Batch processed');

        if (i + BATCH_SIZE < orphans.length) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
      }

      const duration = Date.now() - startTime;
      
      jobLogger.info({
        scanned: cloudinaryIds.size,
        deleted,
        failed,
        notFound,
        durationMs: duration,
      }, '🧹 Cleanup job complete');

      return {
        scanned: cloudinaryIds.size,
        deleted,
        failed,
        notFound,
        durationMs: duration,
      };

    } catch (error) {
      jobLogger.error(error, '💥 Cleanup job failed');
      throw error;
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupOrphanedImages()
    .then((result) => {
      if (result === null) {
        console.log('Lock not acquired — another instance is running this job.');
        process.exit(0);
      }
      console.log('Cleanup result:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Cleanup failed:', err);
      process.exit(1);
    });
}