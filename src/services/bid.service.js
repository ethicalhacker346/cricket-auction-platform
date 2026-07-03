import mongoose from 'mongoose';
import { Bid } from '../models/Bid.js';
import { Auction } from '../models/Auction.js';
import { TournamentTeam } from '../models/TournamentTeam.js';
import { TournamentPlayer } from '../models/TournamentPlayer.js';
import { AppError, assertFound } from '../utils/helpers.js';
import {
  AUCTION_STATUS,
  AUCTION_LOG_ACTIONS,
  BID_STATUS,
  LOT_STATUS,
  REGISTRATION_STATUS,
} from '../config/constants.js';
import { AuctionService } from './auction.service.js';
import { NotificationService } from './notification.service.js';

export class BidService {
  static async placeBid(auctionId, user, { amount }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const auction = assertFound(
        await Auction.findById(auctionId).session(session),
        'Auction not found'
      );

      if (auction.status !== AUCTION_STATUS.LIVE) {
        throw new AppError('Auction is not live', 400);
      }

      const liveState = auction.liveState;
      if (!liveState?.currentTournamentPlayerId || liveState.lotStatus !== LOT_STATUS.BIDDING) {
        throw new AppError('No player is currently on the block', 400);
      }

      const team = assertFound(
        await TournamentTeam.findOne({
          tournamentId: auction.tournamentId,
          ownerId: user._id,
          status: REGISTRATION_STATUS.APPROVED,
        }).session(session),
        'Approved tournament team not found for this owner'
      );

      const tournament = await mongoose.model('Tournament').findById(auction.tournamentId).session(session);
      if (team.roster.length >= tournament.squadSize) {
        throw new AppError('Squad is full', 400);
      }

      const tournamentPlayer = await TournamentPlayer.findById(liveState.currentTournamentPlayerId).session(session);

      const effectiveMin =
        liveState.currentHighestBid === 0
          ? tournamentPlayer.basePrice
          : liveState.currentHighestBid + auction.bidIncrement;

      if (amount < effectiveMin) {
        throw new AppError(`Bid must be at least ${effectiveMin}`, 400);
      }

      const availableBudget = team.wallet.remainingBudget - team.wallet.reservedBudget;
      if (amount > availableBudget) {
        throw new AppError('Insufficient purse balance', 400);
      }

      if (liveState.highestBidderTeamId?.toString() === team._id.toString()) {
        throw new AppError('You already hold the highest bid', 400);
      }

      if (liveState.highestBidderTeamId) {
        const previousTeam = await TournamentTeam.findById(liveState.highestBidderTeamId).session(session);
        if (previousTeam) {
          previousTeam.wallet.reservedBudget = Math.max(
            0,
            previousTeam.wallet.reservedBudget - liveState.currentHighestBid
          );
          await previousTeam.save({ session });
        }

        await Bid.updateMany(
          {
            auctionId,
            tournamentPlayerId: liveState.currentTournamentPlayerId,
            tournamentTeamId: liveState.highestBidderTeamId,
            status: BID_STATUS.WINNING,
          },
          { status: BID_STATUS.OUTBID },
          { session }
        );
      }

      team.wallet.reservedBudget += amount;
      await team.save({ session });

      const bid = await Bid.create(
        [
          {
            auctionId,
            roundId: liveState.currentRoundId,
            tournamentTeamId: team._id,
            tournamentPlayerId: liveState.currentTournamentPlayerId,
            amount,
            status: BID_STATUS.WINNING,
          },
        ],
        { session }
      );

      auction.liveState.currentHighestBid = amount;
      auction.liveState.highestBidderTeamId = team._id;
      auction.liveState.remainingTimeSeconds = auction.lotTimerSeconds;
      auction.liveState.updatedAt = new Date();
      auction.logs.push({
        action: AUCTION_LOG_ACTIONS.BID_PLACED,
        userId: user._id,
        message: `Bid of ${amount} placed by ${team.name}`,
        metadata: { bidId: bid[0]._id, amount, teamId: team._id },
      });

      await auction.save({ session });
      await session.commitTransaction();

      await NotificationService.create({
        userId: user._id,
        type: 'bid',
        title: 'Bid placed',
        message: `Your bid of ${amount} is currently leading`,
        data: { auctionId, bidId: bid[0]._id },
      });

      return bid[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async settleLot(auctionId, user, sold = true) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const auction = assertFound(
        await Auction.findById(auctionId).session(session),
        'Auction not found'
      );

      await AuctionService.assertOrganizer(auction, user);

      const liveState = auction.liveState;
      if (!liveState?.currentTournamentPlayerId) {
        throw new AppError('No active lot to settle', 400);
      }

      const tournamentPlayer = await TournamentPlayer.findById(liveState.currentTournamentPlayerId).session(session);

      if (sold && liveState.highestBidderTeamId) {
        const winningTeam = await TournamentTeam.findById(liveState.highestBidderTeamId).session(session);
        const soldPrice = liveState.currentHighestBid;

        winningTeam.wallet.spentBudget += soldPrice;
        winningTeam.wallet.remainingBudget -= soldPrice;
        winningTeam.wallet.reservedBudget -= soldPrice;
        winningTeam.roster.push({
          tournamentPlayerId: tournamentPlayer._id,
          boughtPrice: soldPrice,
          role: tournamentPlayer.primaryRole,
          boughtAt: new Date(),
        });
        await winningTeam.save({ session });

        tournamentPlayer.isSold = true;
        tournamentPlayer.soldToTeamId = winningTeam._id;
        tournamentPlayer.soldPrice = soldPrice;
        tournamentPlayer.soldAt = new Date();
        await tournamentPlayer.save({ session });

        auction.logs.push({
          action: AUCTION_LOG_ACTIONS.LOT_SOLD,
          userId: user._id,
          message: `Player sold to ${winningTeam.name} for ${soldPrice}`,
          metadata: { teamId: winningTeam._id, soldPrice },
        });

        liveState.lotStatus = LOT_STATUS.SOLD;
      } else {
        if (liveState.highestBidderTeamId) {
          const team = await TournamentTeam.findById(liveState.highestBidderTeamId).session(session);
          team.wallet.reservedBudget = Math.max(0, team.wallet.reservedBudget - liveState.currentHighestBid);
          await team.save({ session });

          await Bid.updateMany(
            {
              auctionId,
              tournamentPlayerId: liveState.currentTournamentPlayerId,
              status: BID_STATUS.WINNING,
            },
            { status: BID_STATUS.OUTBID },
            { session }
          );
        }

        auction.logs.push({
          action: AUCTION_LOG_ACTIONS.LOT_UNSOLD,
          userId: user._id,
          message: 'Player marked unsold',
          metadata: { tournamentPlayerId: tournamentPlayer._id },
        });

        liveState.lotStatus = LOT_STATUS.UNSOLD;
      }

      auction.liveState = {
        currentTournamentPlayerId: null,
        currentRoundId: liveState.currentRoundId,
        currentHighestBid: 0,
        highestBidderTeamId: null,
        remainingTimeSeconds: 0,
        lotStatus: LOT_STATUS.PENDING,
        updatedAt: new Date(),
      };

      await auction.save({ session });
      await session.commitTransaction();

      return auction;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async listBids(auctionId, query = {}) {
    const filter = { auctionId };
    if (query.tournamentPlayerId) filter.tournamentPlayerId = query.tournamentPlayerId;

    return Bid.find(filter)
      .populate('tournamentTeamId', 'name')
      .populate('tournamentPlayerId')
      .sort({ placedAt: -1 })
      .limit(Math.min(Number(query.limit) || 50, 100));
  }
}
