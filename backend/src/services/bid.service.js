/**
 * bid.service.js — Enhanced with Domain Events for realtime bidding
 * -------------------------------------------------------------------
 * Preserves all existing transaction logic.
 * Adds post-commit event emissions for socket layer.
 *
 * Event flow:
 *  REST POST /auctions/:id/bids
 *    -> BidService.placeBid (TX)
 *    -> TX commit
 *    -> emitBidPlaced -> eventBus -> SocketPublisher -> io.to(room).emit('auction:bid:placed')
 *
 * Same for settleLot (SOLD/UNSOLD)
 */

import mongoose from 'mongoose';
import { Bid } from '../models/Bid.js';
import { Auction } from '../models/Auction.js';
import { TournamentTeam } from '../models/TournamentTeam.js';
import { TournamentPlayer } from '../models/TournamentPlayer.js';
import { Tournament } from '../models/Tournament.js';
import { AppError, assertFound } from '../utils/helpers.js';
import {
  AUCTION_STATUS,
  AUCTION_LOG_ACTIONS,
  BID_STATUS,
  LOT_STATUS,
  LOT_OUTCOME,
  REGISTRATION_STATUS,
  NOTIFICATION_TYPES,
} from '../config/constants.js';
import { AuctionService } from './auction.service.js';
import { NotificationService } from './notification.service.js';

// NEW: domain events
import { emitBidPlaced, emitLotSold, emitLotUnsold } from '../events/auction.events.js';

export class BidService {
  static async placeBid(auctionId, user, { amount }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    let previousHighestBid = 0;
    let previousHighestTeamId = null;
    let finalBid = null;
    let finalLiveState = null;
    let finalTeam = null;
    let roundId = null;

    try {
      const auction = assertFound(await Auction.findById(auctionId).session(session), 'Auction not found');

      if (auction.status !== AUCTION_STATUS.LIVE) {
        throw new AppError('Auction is not live', 400);
      }

      const liveState = auction.liveState;
      if (!liveState?.currentTournamentPlayerId || liveState.lotStatus !== LOT_STATUS.BIDDING) {
        throw new AppError('No player is currently on the block', 400);
      }

      previousHighestBid = liveState.currentHighestBid;
      previousHighestTeamId = liveState.highestBidderTeamId;
      roundId = liveState.currentRoundId;

      const team = assertFound(
        await TournamentTeam.findOne({
          tournamentId: auction.tournamentId,
          ownerId: user._id,
          status: REGISTRATION_STATUS.APPROVED,
        }).session(session),
        'Approved tournament team not found for this owner'
      );

      const tournament = await Tournament.findById(auction.tournamentId).session(session);
      if (team.roster.length >= tournament.squadSize) {
        throw new AppError('Squad is full', 400);
      }

      const tournamentPlayer = await TournamentPlayer.findById(liveState.currentTournamentPlayerId).session(session);

      const effectiveMin =
        liveState.currentHighestBid === 0 ? tournamentPlayer.basePrice : liveState.currentHighestBid + auction.bidIncrement;

      if (amount < effectiveMin) {
        throw new AppError(`Bid must be at least ${effectiveMin}`, 400);
      }

      if (liveState.highestBidderTeamId?.toString() === team._id.toString()) {
        throw new AppError('You already hold the highest bid', 400);
      }

      if (!team.canAfford(amount)) {
        throw new AppError('Insufficient purse balance', 400);
      }

      if (liveState.highestBidderTeamId) {
        const previousTeam = await TournamentTeam.findById(liveState.highestBidderTeamId).session(session);
        if (previousTeam) {
          previousTeam.releaseReservation(liveState.currentHighestBid);
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

      team.reserve(amount);
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

      const elapsedSeconds = liveState.updatedAt ? (Date.now() - new Date(liveState.updatedAt).getTime()) / 1000 : 0;
      const trueRemaining = Math.max(0, (liveState.remainingTimeSeconds ?? 0) - elapsedSeconds);

      auction.liveState.currentHighestBid = amount;
      auction.liveState.highestBidderTeamId = team._id;
      auction.liveState.remainingTimeSeconds = Math.max(trueRemaining, auction.bidResetSeconds);
      auction.liveState.version = (auction.liveState.version ?? 0) + 1;
      auction.liveState.updatedAt = new Date();
      auction.logs.push({
        action: AUCTION_LOG_ACTIONS.BID_PLACED,
        userId: user._id,
        message: `Bid of ${amount} placed by ${team.name}`,
        metadata: { bidId: bid[0]._id, amount, teamId: team._id },
      });

      await auction.save({ session });
      await session.commitTransaction();

      // Capture for post-commit emission
      finalBid = bid[0];
      finalLiveState = { ...auction.liveState.toObject?.() || auction.liveState };
      finalTeam = team;

      await NotificationService.create({
        userId: user._id,
        type: NOTIFICATION_TYPES.BID_UPDATE,
        title: 'Bid placed',
        message: `Your bid of ${amount} is currently leading`,
        data: { auctionId, bidId: bid[0]._id },
      });

      // ---- SOCKET EVENT AFTER COMMIT (non-blocking) ----
      try {
        emitBidPlaced(auctionId, {
          bid: finalBid,
          tournamentPlayerId: liveState.currentTournamentPlayerId,
          roundId: roundId,
          amount,
          teamId: team._id,
          teamName: team.name,
          previousHighestBid,
          previousHighestTeamId,
          liveState: finalLiveState,
          placedBy: user._id,
        });
      } catch (e) {
        console.error('[BidService] emitBidPlaced failed', e);
      }

      return finalBid;
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

    let resultAuction = null;
    let soldInfo = null;
    let liveStateForEvent = null;
    let tournamentPlayerId = null;
    let roundIdToCheck = null;

    try {
      const auction = assertFound(await Auction.findById(auctionId).session(session), 'Auction not found');

      await AuctionService.assertOrganizer(auction, user);

      const liveState = auction.liveState;
      if (!liveState?.currentTournamentPlayerId) {
        throw new AppError('No active lot to settle', 400);
      }

      tournamentPlayerId = liveState.currentTournamentPlayerId;
      const tournamentPlayer = await TournamentPlayer.findById(liveState.currentTournamentPlayerId).session(session);
      roundIdToCheck = liveState.currentRoundId;

      if (sold && liveState.highestBidderTeamId) {
        const winningTeam = await TournamentTeam.findById(liveState.highestBidderTeamId).session(session);
        const soldPrice = liveState.currentHighestBid;

        winningTeam.commitSpend(soldPrice);
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
        tournamentPlayer.lotOutcome = LOT_OUTCOME.SOLD;
        await tournamentPlayer.save({ session });

        auction.logs.push({
          action: AUCTION_LOG_ACTIONS.LOT_SOLD,
          userId: user._id,
          message: `Player sold to ${winningTeam.name} for ${soldPrice}`,
          metadata: { teamId: winningTeam._id, soldPrice },
        });

        liveState.lotStatus = LOT_STATUS.SOLD;

        soldInfo = {
          soldPrice,
          soldToTeamId: winningTeam._id,
          soldToTeamName: winningTeam.name,
          ownerId: winningTeam.ownerId,
        };

        await NotificationService.create({
          userId: winningTeam.ownerId,
          type: NOTIFICATION_TYPES.AUCTION_UPDATE,
          title: 'Player acquired',
          message: `${winningTeam.name} won the bid for ${soldPrice}`,
          data: { auctionId, tournamentPlayerId: tournamentPlayer._id },
        });
      } else {
        if (liveState.highestBidderTeamId) {
          const team = await TournamentTeam.findById(liveState.highestBidderTeamId).session(session);
          team.releaseReservation(liveState.currentHighestBid);
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

        tournamentPlayer.lotOutcome = LOT_OUTCOME.UNSOLD;
        await tournamentPlayer.save({ session });

        auction.logs.push({
          action: AUCTION_LOG_ACTIONS.LOT_UNSOLD,
          userId: user._id,
          message: 'Player marked unsold',
          metadata: { tournamentPlayerId: tournamentPlayer._id },
        });

        liveState.lotStatus = LOT_STATUS.UNSOLD;
      }

      // Capture liveState before resetting
      liveStateForEvent = {
        ...liveState.toObject?.(),
        ...liveState,
      };

      auction.liveState = {
        currentTournamentPlayerId: null,
        currentRoundId: roundIdToCheck,
        currentHighestBid: 0,
        highestBidderTeamId: null,
        remainingTimeSeconds: 0,
        lotStatus: LOT_STATUS.PENDING,
        version: (liveState.version ?? 0) + 1,
        updatedAt: new Date(),
      };

      await auction.save({ session });
      await AuctionService.checkRoundCompletion(roundIdToCheck, session);
      await session.commitTransaction();

      resultAuction = auction;

      // ---- SOCKET EVENTS AFTER COMMIT ----
      try {
        if (sold && soldInfo) {
          emitLotSold(auctionId, {
            tournamentPlayerId,
            roundId: roundIdToCheck,
            soldPrice: soldInfo.soldPrice,
            soldToTeamId: soldInfo.soldToTeamId,
            soldToTeamName: soldInfo.soldToTeamName,
            liveState: resultAuction.liveState,
            settledBy: user._id,
          });
        } else {
          emitLotUnsold(auctionId, {
            tournamentPlayerId,
            roundId: roundIdToCheck,
            liveState: resultAuction.liveState,
            settledBy: user._id,
          });
        }
      } catch (e) {
        console.error('[BidService] settleLot emit failed', e);
      }

      return resultAuction;
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
