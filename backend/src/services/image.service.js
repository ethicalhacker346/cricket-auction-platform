// src/services/image.service.js
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import crypto from 'crypto';

const CLOUD_NAME   = process.env.CLOUDINARY_CLOUD_NAME;
const FOLDER_PREFIX = process.env.CLOUDINARY_FOLDER_PREFIX || 'cricket-auction';
const MAX_DIMENSION = 1600;

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const FOLDERS = {
  player:     `${FOLDER_PREFIX}/players`,
  franchise:  `${FOLDER_PREFIX}/franchises`,
  tournament: `${FOLDER_PREFIX}/tournaments`,
};

/**
 * Upload a buffer stream to Cloudinary.
 */
export async function upload(buffer, entityType, entityId, fieldName, options = {}) {
  const publicId = _buildPublicId(entityType, entityId, fieldName);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: '',                 // publicId already contains full path
        resource_type: 'image',
        overwrite: true,
        invalidate: true,           // purge CDN cache
        transformation: [
          { width: MAX_DIMENSION, height: MAX_DIMENSION, crop: 'limit' },
          { quality: 'auto:best', fetch_format: 'auto' }, // WebP/AVIF
        ],
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url:     result.secure_url,
          publicId: result.public_id,
          bytes:    result.bytes,
          format:   result.format,
          width:    result.width,
          height:   result.height,
        });
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

/**
 * Delete an asset. Never throws — deletion must never break user flow.
 */
export async function destroy(urlOrPublicId) {
  const publicId = extractPublicId(urlOrPublicId) || urlOrPublicId;
  if (!publicId) return { result: 'not_found' };

  try {
    return await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: 'image',
    });
  } catch (err) {
    console.error('[ImageService.destroy]', err.message);
    return { result: 'error', error: err.message };
  }
}

/**
 * Generate a responsive delivery URL.
 */
export function generateUrl(url, { width, height, crop = 'fill', gravity = 'auto' } = {}) {
  if (!url) return null;
  const publicId = extractPublicId(url);
  if (!publicId) return url; // fallback for non-Cloudinary URLs

  return cloudinary.url(publicId, {
    width, height, crop, gravity,
    quality: 'auto',
    fetch_format: 'auto',
    secure: true,
  });
}

/**
 * Extract public_id from a Cloudinary URL.
 * SECURITY: Only extracts if the hostname matches OUR cloud name.
 * This prevents a user from passing another app's Cloudinary URL
 * and tricking us into deleting their assets.
 */
export function extractPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(CLOUD_NAME)) return null;

    const segments = parsed.pathname.split('/');
    const uploadIdx = segments.indexOf('upload');
    if (uploadIdx === -1) return null;

    const afterUpload = segments.slice(uploadIdx + 1);
    const startIdx = /^v\d+$/.test(afterUpload[0]) ? 1 : 0;
    const withExt = afterUpload.slice(startIdx).join('/');
    return withExt.replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
}

/**
 * Build responsive srcset map for frontend <img srcset="…">
 */
export function responsiveSrcset(url, breakpoints = [150, 300, 600, 1200]) {
  return breakpoints.reduce((acc, w) => {
    acc[`${w}w`] = generateUrl(url, { width: w, crop: 'fill' });
    return acc;
  }, {});
}

/* ── Private ─────────────────────────────────────────────────────────────── */

function _buildPublicId(entityType, entityId, fieldName) {
  const hash = crypto
    .createHash('sha256')
    .update(`${entityId}:${fieldName}:${Date.now()}`)
    .digest('hex')
    .slice(0, 8);

  return `${FOLDERS[entityType]}/${entityId}_${fieldName}_${hash}`;
}