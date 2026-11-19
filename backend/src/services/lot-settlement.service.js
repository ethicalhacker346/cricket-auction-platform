import { Bid } from '../models/Bid.js';
import { AuctionRound } from '../models/AuctionRound.js';
import { TournamentPlayer } from '../models/TournamentPlayer.js';
import { TournamentTeam } from '../models/TournamentTeam.js';
import { AppError, assertFound } from '../utils/helpers.js';
import { AUCTION_LOG_ACTIONS, BID_STATUS, LOT_OUTCOME, LOT_STATUS, REGISTRATION_STATUS, ROUND_TYPE } from '../config/constants.js';

/** Fence a confirmation to the reviewed lot/pass, not whatever is active later. */
export function assertLotTarget(auction, expected = {}, playerId = auction.liveState?.currentTournamentPlayerId, roundId = auction.liveState?.currentRoundId) {
  if ((expected.tournamentPlayerId && String(expected.tournamentPlayerId) !== String(playerId))
    || (expected.roundId && String(expected.roundId) !== String(roundId))
    || (expected.expectedVersion !== undefined && expected.expectedVersion !== auction.liveState?.version - 1)) {
    const error = new AppError('The auction changed after this decision was opened. Review the current player, pass and bid before confirming again.', 409);
    error.code = 'STALE_LOT_DECISION';
    throw error;
  }
}

/**
 * Shared financial settlement inside an AuctionCommandService transaction.
 * Permanent retirement of an active lot must release its winning reservation
 * and close the clock in the SAME command, never as two separate HTTP calls.
 */
export async function settleActiveLot(scope, outcome, expected = {}) {
  const { auction, tournament, journal, session } = scope;
  const live = auction.liveState;
  if (!live?.currentTournamentPlayerId || live.lotStatus !== LOT_STATUS.BIDDING) {
    throw new AppError('No active lot to settle', 409);
  }
  assertLotTarget(auction, expected);
  const sold = outcome === LOT_OUTCOME.SOLD;
  const permanent = outcome === LOT_OUTCOME.PERMANENT_UNSOLD;
  if (sold && !live.highestBidderTeamId) throw new AppError('A winning bid is required to mark sold', 400);
  const round = assertFound(await AuctionRound.findOne({ _id: live.currentRoundId, auctionId: auction._id }).session(session), 'Active round not found');
  if (permanent && round.type !== ROUND_TYPE.UNSOLD) throw new AppError('Permanent Unsold is available only in an unsold pass', 409);
  const player = assertFound(await TournamentPlayer.findOne({
    _id: live.currentTournamentPlayerId, tournamentId: auction.tournamentId,
    status: REGISTRATION_STATUS.APPROVED, lotOutcome: LOT_OUTCOME.IN_PROGRESS,
    auctionRoundId: round._id,
  }).session(session).populate({ path: 'playerId', select: 'fullName', options: { session } }), 'Active player not found');
  journal.track(player);
  let winningTeam;
  if (live.highestBidderTeamId) {
    winningTeam = assertFound(await TournamentTeam.findById(live.highestBidderTeamId).session(session), 'Leading team not found');
    journal.track(winningTeam);
    if (sold) {
      if (winningTeam.status !== REGISTRATION_STATUS.APPROVED || String(winningTeam.tournamentId) !== String(auction.tournamentId)) {
        throw new AppError('Leading team is no longer approved for this tournament', 409);
      }
      if (winningTeam.roster.length >= (auction.auctionConfiguration?.squadSize ?? tournament.squadSize)) {
        throw new AppError('Leading team squad is now full; review this lot before settling', 409);
      }
      if (winningTeam.roster.some((entry) => String(entry.tournamentPlayerId) === String(player._id))) {
        throw new AppError('Player is already in the leading team roster', 409);
      }
      winningTeam.commitSpend(live.currentHighestBid);
      winningTeam.roster.push({ tournamentPlayerId: player._id, boughtPrice: live.currentHighestBid, role: player.primaryRole, boughtAt: new Date() });
    } else {
      winningTeam.releaseReservation(live.currentHighestBid);
      const bids = await Bid.find({ auctionId: auction._id, tournamentPlayerId: player._id, status: BID_STATUS.WINNING }).session(session);
      for (const bid of bids) {
        journal.track(bid, ['status']);
        bid.status = BID_STATUS.OUTBID;
        await bid.save({ session });
      }
    }
    await winningTeam.save({ session });
  }
  player.lotOutcome = outcome;
  if (sold) {
    player.isSold = true;
    player.soldToTeamId = winningTeam._id;
    player.soldPrice = live.currentHighestBid;
    player.soldAt = new Date();
    scope.label = `Sell ${player.playerId?.fullName || 'player'} to ${winningTeam.name} for ${live.currentHighestBid}`;
  } else {
    player.isSold = false;
    player.soldToTeamId = undefined; player.soldPrice = undefined; player.soldAt = undefined;
    scope.label = `${permanent ? 'Permanently retire' : 'Mark unsold:'} ${player.playerId?.fullName || 'player'}${permanent ? ' from further passes' : ''}`;
  }
  if (permanent) {
    player.permanentUnsoldAt = new Date();
    player.permanentUnsoldBy = scope.context.identity.userId;
  }
  await player.save({ session });
  auction.logs.push({
    action: sold ? AUCTION_LOG_ACTIONS.LOT_SOLD : permanent ? AUCTION_LOG_ACTIONS.PERMANENT_UNSOLD_MARKED : AUCTION_LOG_ACTIONS.LOT_UNSOLD,
    userId: scope.context.identity.userId, message: scope.label,
    metadata: { tournamentPlayerId: player._id, roundId: round._id, teamId: winningTeam?._id, soldPrice: sold ? live.currentHighestBid : undefined },
  });
  auction.liveState = {
    currentTournamentPlayerId: null, currentRoundId: round._id, currentHighestBid: 0,
    highestBidderTeamId: null, remainingTimeSeconds: 0, lotStatus: LOT_STATUS.PENDING,
    version: live.version, updatedAt: new Date(),
  };
  await auction.save({ session });
  return { player, roundId: round._id, winningTeam };
}
