import { User } from '../../src/models/User.js';
import { Player } from '../../src/models/Player.js';
import { Tournament } from '../../src/models/Tournament.js';
import { TournamentPlayer } from '../../src/models/TournamentPlayer.js';
import { TournamentTeam } from '../../src/models/TournamentTeam.js';
import { Franchise } from '../../src/models/Franchise.js';
import { Auction } from '../../src/models/Auction.js';
import { AuctionRound } from '../../src/models/AuctionRound.js';
import { createTokenPair } from '../../src/utils/jwt.js';

export async function seedAuction({ playerCount = 3, splitRounds = false } = {}) {
  // insertMany deliberately bypasses password hashing in non-login fixtures.
  const users = await User.insertMany([
    ['Organizer', 'ORGANIZER'], ['Other Organizer', 'ORGANIZER'], ['Owner One', 'FRANCHISE_OWNER'], ['Owner Two', 'FRANCHISE_OWNER'],
    ...Array.from({ length: playerCount + 1 }, (_, index) => [`Player ${index + 1}`, 'PLAYER']),
  ].map(([name, role], index) => ({ name, role, email: `fixture-${index}@example.test`, password: 'unused-test-password' })));
  const [organizer, otherOrganizer, owner1, owner2, ...playerUsers] = users;
  const tournament = await Tournament.create({ name: 'Test League', slug: 'test-league', organizerId: organizer._id,
    status: 'AUCTION_SCHEDULED', defaultPurse: 1000, minBidIncrement: 10, lotTimerSeconds: 600, squadSize: 15, playerRegistrationOpen: true });
  const profiles = await Player.insertMany(playerUsers.map((user, index) => ({ userId: user._id, fullName: user.name,
    primaryRole: 'BATSMAN', cricHeroesUrl: `https://cricheroes.com/player-profile/${100 + index}/test-player` })));
  const players = await TournamentPlayer.insertMany(profiles.slice(0, playerCount).map((profile, index) => ({
    tournamentId: tournament._id, playerId: profile._id, userId: playerUsers[index]._id, status: 'APPROVED', primaryRole: 'BATSMAN', basePrice: 100,
  })));
  const franchises = await Franchise.insertMany([owner1, owner2].map((owner, index) => ({ ownerId: owner._id, name: `Team ${index + 1}`, slug: `team-${index + 1}` })));
  const teams = await TournamentTeam.insertMany(franchises.map((franchise, index) => ({
    tournamentId: tournament._id, franchiseId: franchise._id, ownerId: [owner1, owner2][index]._id,
    name: franchise.name, status: 'APPROVED', wallet: { initialBudget: 1000, remainingBudget: 1000, reservedBudget: 0, spentBudget: 0 },
  })));
  const auction = await Auction.create({ tournamentId: tournament._id, name: 'Test Auction', status: 'DRAFT',
    bidIncrementTiers: [{ upTo: null, increment: 10 }], lotTimerSeconds: 600, bidResetSeconds: 12,
    auctionConfiguration: { pursePerTeam: 1000, squadSize: 15, lotTimerSeconds: 600, bidResetSeconds: 12 } });
  const rounds = await AuctionRound.insertMany((splitRounds ? [players.slice(0, -1), players.slice(-1)] : [players]).map((pool, index) => ({
    auctionId: auction._id, name: `Round ${index + 1}`, order: index + 1, playerIds: pool.map((player) => player._id), type: 'normal', status: 'PENDING',
  })));
  const token = (user) => createTokenPair(user).accessToken;
  return { organizer, otherOrganizer, owner1, owner2, playerUsers, profiles, players, teams, auction, tournament, rounds, token };
}
