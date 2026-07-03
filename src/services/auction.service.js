import mongoose from 'mongoose';
import { Auction } from '../models/Auction.js';
import { AuctionRound } from '../models/AuctionRound.js';
import { Tournament } from '../models/Tournament.js';
import { TournamentPlayer } from '../models/TournamentPlayer.js';
import { AppError, assertFound } from '../utils/helpers.js';
import {
  AUCTION_STATUS,
  AUCTION_LOG_ACTIONS,
  LOT_STATUS,
  REGISTRATION_STATUS,
  ROUND_STATUS,
  TOURNAMENT_STATUS,
} from '../config/constants.js';
import { TournamentService } from './tournament.service.js';

export class AuctionService {
  static async create(tournamentId, user, payload = {}) {
    const tournament = await TournamentService.getById(tournamentId);
    TournamentService.assertOrganizerAccess(tournament, user);

    if (tournament.status !== TOURNAMENT_STATUS.TEAMS_APPROVED &&
        tournament.status !== TOURNAMENT_STATUS.AUCTION_SCHEDULED) {
      throw new AppError('Teams must be approved before creating an auction', 400);
    }

    const existing = await Auction.findOne({ tournamentId });
    if (existing) {
      throw new AppError('Auction already exists for this tournament', 409);
    }

    const auction = await Auction.create({
      tournamentId,
      bidIncrement: payload.bidIncrement ?? tournament.minBidIncrement,
      lotTimerSeconds: payload.lotTimerSeconds ?? tournament.lotTimerSeconds,
      scheduledAt: payload.scheduledAt,
      status: AUCTION_STATUS.DRAFT,
      logs: [
        {
          action: AUCTION_LOG_ACTIONS.AUCTION_CREATED,
          userId: user._id,
          message: 'Auction created',
        },
      ],
    });

    tournament.status = TOURNAMENT_STATUS.AUCTION_SCHEDULED;
    await tournament.save();

    return auction;
  }

  static async getByTournament(tournamentId) {
    return assertFound(
      await Auction.findOne({ tournamentId }),
      'Auction not found for this tournament'
    );
  }

  static async getById(auctionId) {
    return assertFound(
      await Auction.findById(auctionId).populate('tournamentId'),
      'Auction not found'
    );
  }

  static async addRound(auctionId, user, payload) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionService.assertOrganizer(auction, user);

    if (auction.status === AUCTION_STATUS.COMPLETED) {
      throw new AppError('Cannot modify a completed auction', 400);
    }

    const round = await AuctionRound.create({
      auctionId,
      name: payload.name,
      order: payload.order,
      type: payload.type ?? 'normal',
      playerIds: payload.playerIds ?? [],
      status: ROUND_STATUS.PENDING,
    });

    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.ROUND_STARTED,
      userId: user._id,
      message: `Round "${round.name}" added`,
      metadata: { roundId: round._id },
    });
    await auction.save();

    return round;
  }

  static async start(auctionId, user) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionService.assertOrganizer(auction, user);

    if (auction.status !== AUCTION_STATUS.DRAFT && auction.status !== AUCTION_STATUS.SCHEDULED) {
      throw new AppError('Auction cannot be started from its current state', 400);
    }

    const approvedTeams = await mongoose.model('TournamentTeam').countDocuments({
      tournamentId: auction.tournamentId,
      status: REGISTRATION_STATUS.APPROVED,
    });

    if (approvedTeams < 2) {
      throw new AppError('At least two approved teams are required to start the auction', 400);
    }

    auction.status = AUCTION_STATUS.LIVE;
    auction.startedAt = new Date();
    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.AUCTION_STARTED,
      userId: user._id,
      message: 'Auction started',
    });
    await auction.save();

    await Tournament.findByIdAndUpdate(auction.tournamentId, {
      status: TOURNAMENT_STATUS.LIVE,
    });

    return auction;
  }

  static async pause(auctionId, user) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionService.assertOrganizer(auction, user);

    if (auction.status !== AUCTION_STATUS.LIVE) {
      throw new AppError('Only live auctions can be paused', 400);
    }

    auction.status = AUCTION_STATUS.PAUSED;
    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.AUCTION_PAUSED,
      userId: user._id,
      message: 'Auction paused',
    });
    await auction.save();

    return auction;
  }

  static async resume(auctionId, user) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionService.assertOrganizer(auction, user);

    if (auction.status !== AUCTION_STATUS.PAUSED) {
      throw new AppError('Only paused auctions can be resumed', 400);
    }

    auction.status = AUCTION_STATUS.LIVE;
    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.AUCTION_RESUMED,
      userId: user._id,
      message: 'Auction resumed',
    });
    await auction.save();

    return auction;
  }

  static async openLot(auctionId, user, { tournamentPlayerId, roundId }) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionService.assertOrganizer(auction, user);

    if (auction.status !== AUCTION_STATUS.LIVE) {
      throw new AppError('Auction must be live to open a lot', 400);
    }

    const round = assertFound(
      await AuctionRound.findOne({ _id: roundId, auctionId }),
      'Auction round not found'
    );

    const tournamentPlayer = assertFound(
      await TournamentPlayer.findOne({
        _id: tournamentPlayerId,
        tournamentId: auction.tournamentId,
        status: REGISTRATION_STATUS.VERIFIED,
        isSold: false,
      }),
      'Player not available for auction'
    );

    if (round.status === ROUND_STATUS.PENDING) {
      round.status = ROUND_STATUS.ACTIVE;
      round.startedAt = new Date();
      await round.save();
    }

    auction.liveState = {
      currentTournamentPlayerId: tournamentPlayer._id,
      currentRoundId: round._id,
      currentHighestBid: 0,
      highestBidderTeamId: null,
      remainingTimeSeconds: auction.lotTimerSeconds,
      lotStatus: LOT_STATUS.BIDDING,
      updatedAt: new Date(),
    };

    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.LOT_OPENED,
      userId: user._id,
      message: `Lot opened for player ${tournamentPlayerId}`,
      metadata: { tournamentPlayerId, roundId },
    });

    await auction.save();
    return auction;
  }

  static async getLiveState(auctionId) {
    const auction = await AuctionService.getById(auctionId);

    const [currentPlayer, currentRound, highestBidder] = await Promise.all([
      auction.liveState?.currentTournamentPlayerId
        ? TournamentPlayer.findById(auction.liveState.currentTournamentPlayerId).populate('playerId')
        : null,
      auction.liveState?.currentRoundId
        ? AuctionRound.findById(auction.liveState.currentRoundId)
        : null,
      auction.liveState?.highestBidderTeamId
        ? mongoose.model('TournamentTeam').findById(auction.liveState.highestBidderTeamId)
        : null,
    ]);

    return {
      auctionId: auction._id,
      status: auction.status,
      liveState: auction.liveState,
      currentPlayer,
      currentRound,
      highestBidder,
    };
  }

  static async complete(auctionId, user) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionService.assertOrganizer(auction, user);

    auction.status = AUCTION_STATUS.COMPLETED;
    auction.completedAt = new Date();
    auction.liveState.lotStatus = LOT_STATUS.PENDING;
    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.AUCTION_COMPLETED,
      userId: user._id,
      message: 'Auction completed',
    });
    await auction.save();

    await Tournament.findByIdAndUpdate(auction.tournamentId, {
      status: TOURNAMENT_STATUS.COMPLETED,
    });

    return auction;
  }

  static async assertOrganizer(auction, user) {
    const tournament = await TournamentService.getById(auction.tournamentId);
    TournamentService.assertOrganizerAccess(tournament, user);
  }
}
