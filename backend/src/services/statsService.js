import { Player } from '../models/Player.js';
import { Franchise } from '../models/Franchise.js';
import { Tournament } from '../models/Tournament.js';

/**
 * Returns public-facing aggregate counts for the marketing/auth screens.
 * Lightweight — uses countDocuments with lean filters.
 */
export async function getPublicStats() {
  const [playersCount, franchisesCount, tournamentsCount] = await Promise.all([
    Player.countDocuments({ isActive: true }),
    Franchise.countDocuments({ isActive: true }),
    Tournament.countDocuments(),
  ]);
  console.log(playersCount , franchisesCount , tournamentsCount);
  console.log("Player:", await Player.countDocuments());
  console.log("Player Active:", await Player.countDocuments({ isActive: true }));

  console.log("Franchise:", await Franchise.countDocuments());
  console.log("Franchise Active:", await Franchise.countDocuments({ isActive: true }));

  console.log("Tournament:", await Tournament.countDocuments());

  return {
    playersCount,
    franchisesCount,
    tournamentsCount,
  };
}