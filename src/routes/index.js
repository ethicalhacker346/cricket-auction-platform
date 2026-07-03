import { Router } from 'express';
import authRoutes from './auth.routes.js';
import tournamentRoutes from './tournament.routes.js';
import playerRoutes from './player.routes.js';
import franchiseRoutes from './franchise.routes.js';
import registrationRoutes from './registration.routes.js';
import notificationRoutes from './notification.routes.js';
import { tournamentAuctionRouter, auctionRouter } from './auction.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Cricket Auction Platform API is running',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/tournaments', tournamentRoutes);
router.use('/tournaments/:tournamentId/registrations', registrationRoutes);
router.use('/tournaments/:tournamentId/auction', tournamentAuctionRouter);
router.use('/players', playerRoutes);
router.use('/franchises', franchiseRoutes);
router.use('/auctions', auctionRouter);
router.use('/notifications', notificationRoutes);

export default router;
