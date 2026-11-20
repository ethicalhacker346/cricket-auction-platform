import { Bid } from '../models/Bid.js';
import { Auction } from '../models/Auction.js';
import { TournamentTeam } from '../models/TournamentTeam.js';
import { TournamentPlayer } from '../models/TournamentPlayer.js';
import { AppError, assertFound } from '../utils/helpers.js';
import { AUCTION_LOG_ACTIONS, BID_STATUS, LOT_STATUS, LOT_OUTCOME, REGISTRATION_STATUS, NOTIFICATION_TYPES } from '../config/constants.js';
import { AuctionService } from './auction.service.js';
import { AuctionCommandService } from './auction-command.service.js';
import { settleActiveLot } from './lot-settlement.service.js';
import { NotificationService } from './notification.service.js';
import { AUCTION_PERMISSIONS } from './permission.engine.js';
import { emitBidPlaced, emitLotSold, emitLotUnsold } from '../events/auction.events.js';

export class BidService {
  static async placeBid(auctionId, user, { amount }) {
    if (!Number.isSafeInteger(amount) || amount < 1) throw new AppError('Bid amount must be a positive safe integer', 400);
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.PLACE_BID,
      kind: 'BID_PLACED', label: `Place bid of ${amount}`,
    }, async (scope) => {
      const { auction, tournament, context, journal, session, outbox, afterCommit } = scope;
      const live = auction.liveState;
      if (!live?.currentTournamentPlayerId || live.lotStatus !== LOT_STATUS.BIDDING) throw new AppError('No player is currently on the block', 400);
      const elapsed = live.updatedAt ? Math.max(0, (Date.now() - new Date(live.updatedAt).getTime()) / 1000) : 0;
      const remaining = Math.max(0, (live.remainingTimeSeconds ?? 0) - elapsed);
      if (remaining <= 0) throw new AppError('The lot timer has expired; wait for the organizer', 409);
      // Never trust a team ID supplied by the client or a stale HTTP policy context.
      const team = assertFound(await TournamentTeam.findOne({
        _id: context.ownership.team.id, tournamentId: auction.tournamentId,
        ownerId: user._id, status: REGISTRATION_STATUS.APPROVED,
      }).session(session), 'Approved tournament team not found for this owner');
      if (team.roster.length >= (auction.auctionConfiguration?.squadSize ?? tournament.squadSize)) throw new AppError('Squad is full', 400);
      if (String(live.highestBidderTeamId) === String(team._id)) throw new AppError('You already hold the highest bid', 400);
      const player = assertFound(await TournamentPlayer.findOne({
        _id: live.currentTournamentPlayerId, tournamentId: auction.tournamentId,
        status: REGISTRATION_STATUS.APPROVED, lotOutcome: LOT_OUTCOME.IN_PROGRESS,
      }).session(session).populate({ path: 'playerId', select: 'fullName', options: { session } }), 'Active player not found');
      journal.track(player); // approval/base-price guards; does not rewind their profile
      const minimum = live.currentHighestBid === 0 ? Math.max(1, player.basePrice) : live.currentHighestBid + auction.getBidIncrement(live.currentHighestBid);
      if (amount < minimum) throw new AppError(`Bid must be at least ${minimum}`, 400);
      if (!team.canAfford(amount)) throw new AppError('Insufficient purse balance', 400);
      const previousHighestBid = live.currentHighestBid;
      const previousHighestTeamId = live.highestBidderTeamId;
      if (previousHighestTeamId) {
        const previousTeam = assertFound(await TournamentTeam.findById(previousHighestTeamId).session(session), 'Previous leading team not found');
        journal.track(previousTeam, ['wallet']);
        previousTeam.releaseReservation(previousHighestBid);
        await previousTeam.save({ session });
        const previousBids = await Bid.find({ auctionId, tournamentPlayerId: player._id, status: BID_STATUS.WINNING }).session(session);
        for (const bid of previousBids) {
          journal.track(bid, ['status']);
          bid.status = BID_STATUS.OUTBID;
          await bid.save({ session });
        }
      }
      journal.track(team, ['wallet']);
      team.reserve(amount);
      await team.save({ session });
      const [bid] = await Bid.create([{
        auctionId, roundId: live.currentRoundId, tournamentTeamId: team._id,
        tournamentPlayerId: player._id, amount, status: BID_STATUS.WINNING,
      }], { session });
      journal.created(bid);
      live.currentHighestBid = amount;
      live.highestBidderTeamId = team._id;
      live.remainingTimeSeconds = Math.max(remaining, auction.bidResetSeconds);
      live.timerTotalSeconds = Math.max(live.timerTotalSeconds || auction.lotTimerSeconds, live.remainingTimeSeconds);
      live.updatedAt = new Date();
      scope.label = `${team.name} bid ${amount} for ${player.playerId?.fullName || 'player'}`;
      auction.logs.push({ action: AUCTION_LOG_ACTIONS.BID_PLACED, userId: user._id,
        message: scope.label, metadata: { bidId: bid._id, amount, teamId: team._id } });
      await auction.save({ session });
      outbox.push(() => emitBidPlaced(auctionId, {
        bid, tournamentPlayerId: player._id, roundId: live.currentRoundId, amount,
        teamId: team._id, teamName: team.name, previousHighestBid, previousHighestTeamId,
        liveState: live, placedBy: user._id,
      }));
      afterCommit.push(() => NotificationService.create({
        userId: user._id, type: NOTIFICATION_TYPES.BID_UPDATE, title: 'Bid placed',
        message: `Your bid of ${amount} is currently leading`, data: { auctionId, bidId: bid._id },
      }));
      return bid;
    });
    return command.result;
  }

  static async settleLot(auctionId, user, sold = true, expected = {}) {
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.SETTLE_LOT,
      kind: sold ? 'LOT_SOLD' : 'LOT_UNSOLD', label: sold ? 'Mark player sold' : 'Mark player unsold',
    }, async (scope) => {
      const { session, outbox, journal, afterCommit } = scope;
      const { player, roundId, winningTeam } = await settleActiveLot(scope, sold ? LOT_OUTCOME.SOLD : LOT_OUTCOME.UNSOLD, expected);
      let finalAuction;
      // Verdict precedes round closure/relisting, all at the same command revision.
      outbox.push(() => sold ? emitLotSold(auctionId, {
        tournamentPlayerId: player._id, roundId, soldPrice: player.soldPrice,
        soldToTeamId: winningTeam._id, soldToTeamName: winningTeam.name,
        liveState: finalAuction.liveState, settledBy: user._id,
      }) : emitLotUnsold(auctionId, {
        tournamentPlayerId: player._id, roundId, liveState: finalAuction.liveState, settledBy: user._id,
      }));
      await AuctionService.checkRoundCompletion(roundId, session, outbox, journal);
      finalAuction = await Auction.findById(auctionId).session(session);
      if (sold) afterCommit.push(() => NotificationService.create({
        userId: winningTeam.ownerId, type: NOTIFICATION_TYPES.AUCTION_UPDATE, title: 'Player acquired',
        message: `${winningTeam.name} won the bid for ${player.soldPrice}`, data: { auctionId, tournamentPlayerId: player._id },
      }));
    });
    return command.auction;
  }

  static async listBids(auctionId, query = {}) {
    return Bid.find({ auctionId, ...(query.tournamentPlayerId ? { tournamentPlayerId: query.tournamentPlayerId } : {}) })
      .populate('tournamentTeamId', 'name').populate('tournamentPlayerId')
      .sort({ placedAt: -1, _id: -1 }).limit(Math.min(Number(query.limit) || 50, 100));
  }
}
