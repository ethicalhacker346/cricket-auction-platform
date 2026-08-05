import { Router } from 'express';
import { getPublicStatsHandler } from '../controllers/statsController.js';

const router = Router();

// Public — no auth required; consumed by login/register landing pages
router.get('/public', getPublicStatsHandler);

export default router;