// src/middleware/upload.middleware.js
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';

const MAX_SIZE = parseInt(process.env.UPLOAD_MAX_FILE_SIZE, 10) || 5 * 1024 * 1024;
const ALLOWED_EXTS = new Set(
  (process.env.UPLOAD_ALLOWED_FORMATS || 'jpg,jpeg,png,webp,gif').split(',')
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

/**
 * Deep validation via magic bytes (prevents mime-type spoofing).
 */
export async function validateImageBuffer(req, res, next) {
  if (!req.file) return next();

  try {
    const type = await fileTypeFromBuffer(req.file.buffer);
    if (!type || !type.mime.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid image. File content does not match an image format.',
      });
    }
    if (!ALLOWED_EXTS.has(type.ext)) {
      return res.status(400).json({
        success: false,
        error: `Format .${type.ext} not allowed. Use: ${[...ALLOWED_EXTS].join(', ')}`,
      });
    }
    req.file.detectedMime = type.mime;
    req.file.detectedExt = type.ext;
    next();
  } catch (err) {
    next(err);
  }
}

export const singleUpload = (fieldName = 'image') => upload.single(fieldName);