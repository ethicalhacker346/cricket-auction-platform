import { asyncHandler } from '../utils/asyncHandler.js';
import { getPublicStats } from '../services/statsService.js';

export const getPublicStatsHandler = asyncHandler(async (_req, res) => {
  const stats = await getPublicStats();
  console.log(stats);
  res.status(200).json({
    success: true,
    data: stats,
  });
});