import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { playerController } from '../controllers/player.controller.js';
import { createPlayerSchema, idParamSchema } from '../validators/schemas.js';
import { singleUpload, validateImageBuffer } from '../middleware/upload.middleware.js';
import { imageUploadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/', asyncHandler(playerController.list));
router.get('/me', authenticate, asyncHandler(playerController.me));
router.post('/', authenticate, validate(createPlayerSchema), asyncHandler(playerController.create));
// library
router.patch('/me/profile-image', authenticate, imageUploadLimiter, singleUpload('image'), validateImageBuffer, playerController.uploadProfileImage);
router.delete('/me/profile-image', authenticate, playerController.removeProfileImage);
router.patch('/me', authenticate, validate(createPlayerSchema.partial()), asyncHandler(playerController.updateMe));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(playerController.getById));

export default router;
