import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { franchiseController } from '../controllers/franchise.controller.js';
import { createFranchiseSchema, idParamSchema } from '../validators/schemas.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize(USER_ROLES.FRANCHISE_OWNER, USER_ROLES.ADMIN),
  validate(createFranchiseSchema),
  asyncHandler(franchiseController.create)
);

router.get(
  '/mine',
  authenticate,
  authorize(USER_ROLES.FRANCHISE_OWNER, USER_ROLES.ADMIN),
  asyncHandler(franchiseController.listMine)
);

router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(franchiseController.getById));

router.patch(
  '/:id',
  authenticate,
  authorize(
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.ADMIN
  ),
  validate(idParamSchema, 'params'),
  
  asyncHandler(franchiseController.update)
);

export default router;
