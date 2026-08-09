import { extractPublicId, generateUrl } from '../services/image.service.js';

/**
 * Strip image fields from a Mongoose document for safe public responses.
 */
export function sanitizeImageFields(doc, fields = ['profileImagePublicId', 'logoPublicId']) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  fields.forEach((f) => delete obj[f]);
  return obj;
}

/**
 * Build a full image update payload for a service layer.
 * Returns { $set: {...}, $unset: {...} } style operations if needed.
 */
export function buildImageUpdateOps(url, publicId, urlField, publicIdField) {
  return {
    [urlField]: url,
    [publicIdField]: publicId,
  };
}

export { extractPublicId, generateUrl };