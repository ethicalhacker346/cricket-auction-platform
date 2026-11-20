/**
 * auction.service.js — Enhanced with Domain Events for Socket.IO realtime layer
 * -------------------------------------------------------------------------------
 * Commands are journaled atomically with their domain writes.
 * After each successful MongoDB transaction/commit, we emit domain events
 * via auction.events.js -> eventBus -> SocketPublisher -> io.to(room).emit()
 *
 * Event emissions are fire-and-forget AFTER commit, never before.
 */

import mongoose from "mongoose";
import { Auction } from "../models/Auction.js";
import { AuctionRound } from "../models/AuctionRound.js";
import { Bid } from "../models/Bid.js";
import { Tournament } from "../models/Tournament.js";
import { TournamentPlayer } from "../models/TournamentPlayer.js";
import { TournamentTeam } from "../models/TournamentTeam.js";
import {
  AuctionViewer,
  VIEWER_HEARTBEAT_TTL_SECONDS,
} from "../models/AuctionViewer.js";
import { AppError, assertFound } from "../utils/helpers.js";
import {
  AUCTION_STATUS,
  AUCTION_LOG_ACTIONS,
  LOT_STATUS,
  LOT_OUTCOME,
  REGISTRATION_STATUS,
  ROUND_TYPE,
  ROUND_STATUS,
  TOURNAMENT_STATUS,
} from "../config/constants.js";
import { TournamentService } from "./tournament.service.js";
import { AuctionAuthorizationService } from "./auction-authorization.service.js";
import { AUCTION_PERMISSIONS } from "./permission.engine.js";

// ---- NEW: Domain Events Import (only additive) ----
import {
  emitAuctionCreated,
  emitAuctionStarted,
  emitAuctionPaused,
  emitAuctionResumed,
  emitAuctionCompleted,
  emitRulesUpdated,
  emitRoundAdded,
  emitRoundUpdated,
  emitRoundDeleted,
  emitRoundCompleted,
  emitLotOpened,
  emitLotTimeExtended,
  emitLotPermanentUnsold,
  emitViewerCountUpdated,
} from "../events/auction.events.js";
import { AuctionCommandService } from "./auction-command.service.js";
import { assertLotTarget, settleActiveLot } from './lot-settlement.service.js';

export class AuctionService {
  static buildDefaultTiers(tournament) {
    return [{ upTo: null, increment: tournament.minBidIncrement }];
  }
  static auctionPopulate = [
    {
      path: "tournamentId",
      populate: {
        path: "organizerId",
        select: "name email avatar",
      },
    },
  ];

  static async create(tournamentId, user, payload = {}) {
    const tournament = await TournamentService.getById(tournamentId);
    TournamentService.assertOrganizerAccess(tournament, user);

    if (tournament.status !== TOURNAMENT_STATUS.TEAMS_APPROVED) {
      throw new AppError(
        "Teams must be approved before creating an auction",
        400,
      );
    }

    const existing = await Auction.findOne({ tournamentId });
    if (existing) {
      throw new AppError("Auction already exists for this tournament", 409);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const auctionConfiguration = {
        pursePerTeam: tournament.defaultPurse,
        squadSize: tournament.squadSize,
        maxTeams: tournament.maxTeams,
        currency: tournament.currency,
        lotTimerSeconds: payload.lotTimerSeconds ?? tournament.lotTimerSeconds,
        bidResetSeconds: payload.bidResetSeconds ?? 12,
        minimumBidIncrement: tournament.minBidIncrement,
        bidIncrementTiers: payload.bidIncrementTiers?.length
          ? payload.bidIncrementTiers
          : AuctionService.buildDefaultTiers(tournament),
        registrationDeadline:
          tournament.registrationDeadline ??
          payload.registrationDeadline ??
          null,
        copiedAt: new Date(),
      };

      const [auction] = await Auction.create(
        [
          {
            tournamentId,
            name: payload.name,
            auctionConfiguration,
            bidIncrementTiers: auctionConfiguration.bidIncrementTiers,
            lotTimerSeconds: auctionConfiguration.lotTimerSeconds,
            bidResetSeconds: auctionConfiguration.bidResetSeconds,
            scheduledAt: payload.scheduledAt,
            status: AUCTION_STATUS.DRAFT,
            logs: [
              {
                action: AUCTION_LOG_ACTIONS.AUCTION_CREATED,
                userId: user._id,
                message: "Auction created",
              },
            ],
          },
        ],
        { session },
      );

      // May already be AUCTION_SCHEDULED if the organizer used the
      // tournament-level schedule endpoint first — transition only when
      // needed so the two lifecycle entry points can't collide.
      if (tournament.status !== TOURNAMENT_STATUS.AUCTION_SCHEDULED) {
        await tournament.transitionTo(
          TOURNAMENT_STATUS.AUCTION_SCHEDULED,
          session,
        );
      }
      await session.commitTransaction();

      // --- SOCKET EVENT: AFTER commit ---
      emitAuctionCreated(auction._id, {
        auction,
        tournamentId,
        createdBy: user._id,
      });

      return auction;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async findByTournament(tournamentId) {
    return Auction.findOne({ tournamentId })
      .populate(AuctionService.auctionPopulate);
  }

  static async getByTournamentOrFail(tournamentId) {
    return assertFound(
      await Auction.findOne({ tournamentId }).populate(AuctionService.auctionPopulate),
        
      "Auction not found for this tournament",
    );
  }

  static async getById(auctionId) {
    return assertFound(await Auction.findById(auctionId).populate(AuctionService.auctionPopulate), "Auction not found");
  }

  static async getByIdPopulated(auctionId, session = null) {
    return assertFound(
      await Auction.findById(auctionId).select('+undoHeadActionId').session(session).populate(AuctionService.auctionPopulate),
      "Auction not found",
    );
  }

  // Backwards-compatible service boundary. All authorization now flows through
  // the domain authorization service; no role-only check remains here.
  static async assertOrganizer(
    auction,
    user,
    permission = AUCTION_PERMISSIONS.MANAGE_AUCTION,
    authorization = null,
  ) {
    const context = await AuctionAuthorizationService.assertPermission({
      auctionId: auction._id,
      user,
      permission,
      existingContext: authorization,
    });
    return context.tournament;
  }

  static async addRound(auctionId, user, payload) {
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.MANAGE_ROUNDS,
      kind: 'ROUND_ADDED', label: `Add round “${payload.name}”`,
    }, async ({ auction, journal, session, outbox }) => {
      if (await AuctionRound.exists({ auctionId, type: ROUND_TYPE.UNSOLD }).session(session)) {
        throw new AppError('Normal rounds cannot be added after the unsold phase begins. Remaining inventory advances through numbered unsold passes automatically.', 409);
      }
      await AuctionService.validateRoundPlayers(auction, payload.playerIds ?? [], null, session);
      await AuctionService.validateRoundOrder(auctionId, payload.order, null, session);
      const [round] = await AuctionRound.create([{
        auctionId, name: payload.name, order: payload.order, type: ROUND_TYPE.NORMAL,
        playerIds: payload.playerIds ?? [], category: payload.category ?? null,
        status: ROUND_STATUS.PENDING,
      }], { session });
      journal.created(round);
      auction.logs.push({ action: AUCTION_LOG_ACTIONS.ROUND_ADDED, userId: user._id,
        message: `Round “${round.name}” added`, metadata: { roundId: round._id } });
      await auction.save({ session });
      outbox.push(() => emitRoundAdded(auctionId, { round, addedBy: user._id }));
      return round;
    });
    return command.result;
  }

  static async validateRoundPlayers(auction, playerIds, roundId, session) {
    if (new Set(playerIds.map(String)).size !== playerIds.length) throw new AppError('A player can appear only once in a round', 400);
    const count = await TournamentPlayer.countDocuments({
      _id: { $in: playerIds }, tournamentId: auction.tournamentId,
      status: REGISTRATION_STATUS.APPROVED, lotOutcome: LOT_OUTCOME.NOT_LISTED,
    }).session(session);
    if (count !== playerIds.length) throw new AppError('Round players must be approved, available players from this tournament', 400);
    const duplicate = await AuctionRound.exists({
      auctionId: auction._id, ...(roundId ? { _id: { $ne: roundId } } : {}),
      type: ROUND_TYPE.NORMAL, playerIds: { $in: playerIds },
    }).session(session);
    if (duplicate) throw new AppError('A player is already assigned to another round', 400);
  }

  static async validateRoundOrder(auctionId, order, roundId, session) {
    const earlierActivity = await AuctionRound.exists({
      auctionId, ...(roundId ? { _id: { $ne: roundId } } : {}),
      status: { $in: [ROUND_STATUS.ACTIVE, ROUND_STATUS.COMPLETED] }, order: { $gte: order },
    }).session(session);
    if (earlierActivity) throw new AppError('Pending rounds must remain after rounds that have started', 400);
  }

  static async updateRules(auctionId, user, payload = {}) {
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.UPDATE_RULES,
      kind: 'RULES_UPDATED', label: 'Update auction rules',
    }, async ({ auction, session, outbox }) => {
      const patch = {};
      for (const key of ['name', 'scheduledAt', 'lotTimerSeconds', 'bidResetSeconds', 'bidIncrementTiers']) {
        if (payload[key] !== undefined) {
          auction[key] = payload[key];
          patch[key] = payload[key];
        }
      }
      for (const key of ['pursePerTeam', 'squadSize', 'maxTeams', 'currency', 'lotTimerSeconds', 'bidResetSeconds', 'minimumBidIncrement', 'bidIncrementTiers', 'registrationDeadline']) {
        if (payload[key] !== undefined) {
          auction.auctionConfiguration[key] = payload[key];
          patch[key] = payload[key];
        }
      }
      if (!Object.keys(patch).length) throw new AppError('No editable rule fields provided', 400);
      auction.logs.push({ action: AUCTION_LOG_ACTIONS.RULES_UPDATED, userId: user._id,
        message: 'Auction rules updated', metadata: patch });
      await auction.save({ session });
      outbox.push(() => emitRulesUpdated(auctionId, { patch, auction, updatedBy: user._id }));
    });
    return command.auction;
  }

  static async listRounds(auctionId) {
    return AuctionRound.find({ auctionId }).sort({ order: 1 });
  }

  static async updateRound(auctionId, roundId, user, patch = {}) {
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.MANAGE_ROUNDS,
      kind: 'ROUND_UPDATED', label: 'Update auction round',
    }, async (scope) => {
      const { auction, journal, session, outbox } = scope;
      const round = assertFound(await AuctionRound.findOne({ _id: roundId, auctionId }).session(session), 'Auction round not found');
      journal.track(round);
      if (patch.type !== undefined && patch.type !== round.type) throw new AppError('Round type is managed by the auction engine', 400);
      if (round.type === ROUND_TYPE.NORMAL && (patch.playerIds !== undefined || (patch.order !== undefined && patch.order !== round.order))
        && await AuctionRound.exists({ auctionId, type: ROUND_TYPE.UNSOLD }).session(session)) {
        throw new AppError('Normal-round membership and order are locked after the unsold phase begins.', 409);
      }
      if (patch.playerIds !== undefined) {
        if (round.status !== ROUND_STATUS.PENDING || round.type === ROUND_TYPE.UNSOLD) throw new AppError('Only an unstarted normal round can change players', 400);
        await AuctionService.validateRoundPlayers(auction, patch.playerIds, roundId, session);
        round.playerIds = patch.playerIds;
      }
      if (patch.order !== undefined && patch.order !== round.order) {
        if (round.status !== ROUND_STATUS.PENDING || round.type === ROUND_TYPE.UNSOLD) throw new AppError('Cannot reorder a running, completed, or engine-managed round', 400);
        await AuctionService.validateRoundOrder(auctionId, patch.order, roundId, session);
        round.order = patch.order;
      }
      if (patch.name !== undefined) round.name = patch.name;
      if (patch.category !== undefined) round.category = patch.category;
      await round.save({ session });
      scope.label = `Update round “${round.name}”`;
      auction.logs.push({ action: AUCTION_LOG_ACTIONS.ROUND_UPDATED, userId: user._id,
        message: `Round “${round.name}” updated`, metadata: { roundId, patch } });
      await auction.save({ session });
      outbox.push(() => emitRoundUpdated(auctionId, { round, patch, updatedBy: user._id }));
      return round;
    });
    return command.result;
  }

  static async deleteRound(auctionId, roundId, user) {
    await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.MANAGE_ROUNDS,
      kind: 'ROUND_DELETED', label: 'Delete auction round',
    }, async (scope) => {
      const { auction, journal, session, outbox } = scope;
      const round = assertFound(await AuctionRound.findOne({ _id: roundId, auctionId }).session(session), 'Auction round not found');
      if (round.status !== ROUND_STATUS.PENDING || round.type === ROUND_TYPE.UNSOLD) throw new AppError('Only an unstarted normal round can be deleted', 400);
      journal.track(round);
      await round.deleteOne({ session });
      scope.label = `Delete round “${round.name}”`;
      auction.logs.push({ action: AUCTION_LOG_ACTIONS.ROUND_DELETED, userId: user._id,
        message: `Round “${round.name}” deleted`, metadata: { roundId } });
      await auction.save({ session });
      outbox.push(() => emitRoundDeleted(auctionId, { roundId, roundName: round.name, deletedBy: user._id }));
    });
    return { success: true };
  }

  static async start(auctionId, user) {
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.START_AUCTION,
      kind: 'AUCTION_STARTED', label: 'Start auction',
    }, async ({ auction, tournament, session, outbox }) => {
      const approvedTeams = await TournamentTeam.countDocuments({ tournamentId: auction.tournamentId, status: REGISTRATION_STATUS.APPROVED }).session(session);
      if (approvedTeams < 2) throw new AppError('At least two approved teams are required to start the auction', 400);
      auction.startedAt = new Date();
      auction.logs.push({ action: AUCTION_LOG_ACTIONS.AUCTION_STARTED, userId: user._id, message: 'Auction started' });
      await auction.transitionTo(AUCTION_STATUS.LIVE, session);
      if (tournament.status !== TOURNAMENT_STATUS.AUCTION_RUNNING) await tournament.transitionTo(TOURNAMENT_STATUS.AUCTION_RUNNING, session);
      outbox.push(() => emitAuctionStarted(auctionId, { auction, tournamentId: auction.tournamentId, startedBy: user._id }));
    });
    return command.auction;
  }

  static async pause(auctionId, user) {
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.PAUSE_AUCTION,
      kind: 'AUCTION_PAUSED', label: 'Pause auction',
    }, async ({ auction, session, outbox }) => {
      if (auction.liveState?.lotStatus === LOT_STATUS.BIDDING) {
        const elapsed = auction.liveState.updatedAt ? Math.max(0, (Date.now() - new Date(auction.liveState.updatedAt).getTime()) / 1000) : 0;
        auction.liveState.remainingTimeSeconds = Math.max(0, (auction.liveState.remainingTimeSeconds ?? 0) - elapsed);
      }
      auction.liveState.updatedAt = new Date();
      auction.logs.push({ action: AUCTION_LOG_ACTIONS.AUCTION_PAUSED, userId: user._id, message: 'Auction paused' });
      await auction.transitionTo(AUCTION_STATUS.PAUSED, session);
      outbox.push(() => emitAuctionPaused(auctionId, { auction, pausedBy: user._id }));
    });
    return command.auction;
  }

  static async resume(auctionId, user) {
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.RESUME_AUCTION,
      kind: 'AUCTION_RESUMED', label: 'Resume auction',
    }, async ({ auction, session, outbox }) => {
      auction.liveState.updatedAt = new Date();
      auction.logs.push({ action: AUCTION_LOG_ACTIONS.AUCTION_RESUMED, userId: user._id, message: 'Auction resumed' });
      await auction.transitionTo(AUCTION_STATUS.LIVE, session);
      outbox.push(() => emitAuctionResumed(auctionId, { auction, resumedBy: user._id }));
    });
    return command.auction;
  }

  /** An explicit lot ID fences delayed clicks; requestId fences HTTP retries. */
  static async extendLotTime(auctionId, user, { tournamentPlayerId, seconds, requestId }) {
    if (!Number.isSafeInteger(seconds) || seconds < 5 || seconds > 300) throw new AppError('Add between 5 and 300 whole seconds', 400);
    if (typeof requestId !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(requestId)) throw new AppError('A unique request ID is required', 400);
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.EXTEND_LOT_TIME,
      kind: 'LOT_TIME_EXTENDED', label: `Add ${seconds} seconds to the active lot`,
      commandId: `lot-time:${requestId}`, commandFingerprint: `${tournamentPlayerId}:${seconds}`,
    }, async ({ auction, session, outbox }) => {
      const live = auction.liveState;
      if (live?.lotStatus !== LOT_STATUS.BIDDING || !live.currentTournamentPlayerId) throw new AppError('There is no active lot to extend', 409);
      if (String(live.currentTournamentPlayerId) !== String(tournamentPlayerId)) throw new AppError('The active player changed. Review the current lot before adding time.', 409);
      const elapsed = auction.status === AUCTION_STATUS.LIVE && live.updatedAt
        ? Math.max(0, (Date.now() - new Date(live.updatedAt).getTime()) / 1000) : 0;
      const remaining = Math.max(0, (live.remainingTimeSeconds ?? 0) - elapsed) + seconds;
      if (remaining > 3600) throw new AppError('A lot cannot have more than 3600 seconds remaining', 400);
      live.remainingTimeSeconds = remaining;
      live.timerTotalSeconds = Math.max(remaining, Math.min(3600, (live.timerTotalSeconds || auction.lotTimerSeconds) + seconds));
      live.updatedAt = new Date();
      auction.logs.push({ action: AUCTION_LOG_ACTIONS.LOT_TIME_EXTENDED, userId: user._id,
        message: `Organizer added ${seconds} seconds to the current lot`, metadata: { tournamentPlayerId, seconds, remaining } });
      await auction.save({ session });
      outbox.push(() => emitLotTimeExtended(auctionId, { tournamentPlayerId, seconds, liveState: live, status: auction.status, extendedBy: user._id }));
    });
    return command.auction;
  }

  /** The running round wins; otherwise the first configured, uncompleted round. */
  static async runningRound(auctionId, session) {
    const active = await AuctionRound.findOne({ auctionId, status: ROUND_STATUS.ACTIVE }).sort({ order: 1 }).session(session);
    return active ?? AuctionRound.findOne({ auctionId, status: ROUND_STATUS.PENDING, 'playerIds.0': { $exists: true } }).sort({ order: 1 }).session(session);
  }

  static async openLot(auctionId, user, { tournamentPlayerId, roundId }) {
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.OPEN_LOT,
      kind: 'LOT_OPENED', label: 'Open player lot',
    }, async (scope) => {
      const { auction, journal, session, outbox } = scope;
      if (auction.liveState?.lotStatus === LOT_STATUS.BIDDING) throw new AppError('A lot is already open — settle it before opening the next one', 409);
      const round = assertFound(await AuctionService.runningRound(auctionId, session), 'No running round with players is available');
      if (String(round._id) !== String(roundId)) throw new AppError('Select a player from the running round; later rounds cannot be opened yet', 409);
      if (!round.playerIds.some((id) => String(id) === String(tournamentPlayerId))) throw new AppError('Player is not assigned to the running round', 400);
      const tournamentPlayer = await TournamentPlayer.findOne({
        _id: tournamentPlayerId, tournamentId: auction.tournamentId, status: REGISTRATION_STATUS.APPROVED,
        // Every generated pass resets its own inventory to NOT_LISTED. An
        // UNSOLD result is finished for THIS pass, not immediately eligible again.
        lotOutcome: LOT_OUTCOME.NOT_LISTED,
        ...(round.type === ROUND_TYPE.UNSOLD ? { auctionRoundId: round._id } : {}),
      }).session(session);
      if (!tournamentPlayer) throw new AppError('Player is already resolved for this pass or is no longer eligible. Select a waiting player.', 409);
      journal.track(round);
      journal.track(tournamentPlayer);
      if (round.status === ROUND_STATUS.PENDING) {
        round.status = ROUND_STATUS.ACTIVE;
        round.startedAt = new Date();
        await round.save({ session });
      }
      tournamentPlayer.lotOutcome = LOT_OUTCOME.IN_PROGRESS;
      tournamentPlayer.auctionRoundId = round._id;
      await tournamentPlayer.save({ session });
      auction.liveState = {
        currentTournamentPlayerId: tournamentPlayer._id, currentRoundId: round._id,
        currentHighestBid: 0, highestBidderTeamId: null, remainingTimeSeconds: auction.lotTimerSeconds,
        timerTotalSeconds: auction.lotTimerSeconds,
        lotStatus: LOT_STATUS.BIDDING, version: auction.liveState.version, updatedAt: new Date(),
      };
      const populatedPlayer = await TournamentPlayer.findById(tournamentPlayer._id).session(session).populate({ path: 'playerId', options: { session } }).lean();
      scope.label = `Open lot: ${populatedPlayer.playerId?.fullName || tournamentPlayerId}`;
      auction.logs.push({ action: AUCTION_LOG_ACTIONS.LOT_OPENED, userId: user._id,
        message: scope.label, metadata: { tournamentPlayerId, roundId } });
      await auction.save({ session });
      outbox.push(() => emitLotOpened(auctionId, {
        tournamentPlayerId: tournamentPlayer._id, roundId: round._id, currentPlayer: populatedPlayer,
        currentRound: round, liveState: auction.liveState, openedBy: user._id,
      }));
    });
    return command.auction;
  }

  // Viewer presence deliberately uses its own collection, not the command journal.

  static async heartbeatViewer(auctionId, viewerId, userId = null) {
    if (!viewerId) {
      throw new AppError("viewerId is required", 400);
    }
    assertFound(await Auction.exists({ _id: auctionId }), 'Auction not found');
    await AuctionViewer.findOneAndUpdate(
      { auctionId, viewerId },
      {
        $set: { lastSeenAt: new Date(), userId },
        $setOnInsert: { firstSeenAt: new Date() },
      },
      { upsert: true },
    );
    const count = await AuctionService.getViewerCount(auctionId);

    // --- SOCKET ---
    emitViewerCountUpdated(auctionId, count, {
      source: "heartbeat",
      viewerId,
    });

    return count;
  }

  static async removeViewer(auctionId, viewerId) {
    await AuctionViewer.deleteOne({ auctionId, viewerId });
    const count = await AuctionService.getViewerCount(auctionId);

    emitViewerCountUpdated(auctionId, count, {
      source: "leave",
      viewerId,
    });

    return count;
  }

  static async getViewerCount(auctionId) {
    const cutoff = new Date(Date.now() - VIEWER_HEARTBEAT_TTL_SECONDS * 1000);
    return AuctionViewer.countDocuments({
      auctionId,
      lastSeenAt: { $gte: cutoff },
    });
  }

  static async getLiveState(auctionId) {
    const auction = await AuctionService.getById(auctionId);

    const [currentPlayer, currentRound, highestBidder, viewerCount] =
      await Promise.all([
        auction.liveState?.currentTournamentPlayerId
          ? TournamentPlayer.findById(
              auction.liveState.currentTournamentPlayerId,
              
            ).populate("playerId")
          : null,
        auction.liveState?.currentRoundId
          ? AuctionRound.findById(auction.liveState.currentRoundId)
          : null,
        auction.liveState?.highestBidderTeamId
          ? TournamentTeam.findById(auction.liveState.highestBidderTeamId)
          : null,
        AuctionService.getViewerCount(auctionId),
      ]);

    return {
      auctionId: auction._id,
      status: auction.status,
      liveState: auction.liveState,
      currentPlayer,
      currentRound,
      highestBidder,
      viewerCount,
    };
  }

  static async getSnapshot(auctionId) {
    const session = await mongoose.startSession();
    let snapshot;
    try {
      // An undo may change several collections. A plain Promise.all can mix
      // the old player/roster with the new revision and make a client retain
      // that torn frame. Read the business snapshot at ONE committed point.
      await session.withTransaction(async () => {
        snapshot = await AuctionService.readSnapshot(auctionId, session);
      }, { readConcern: { level: 'snapshot' } });
    } finally { await session.endSession(); }
    // Presence is deliberately independent of auction serialization.
    snapshot.viewerCount = await AuctionService.getViewerCount(auctionId);
    return snapshot;
  }

  static async readSnapshot(auctionId, session) {
    const auction = await AuctionService.getByIdPopulated(auctionId, session);
    const tournamentId = auction.tournamentId._id ?? auction.tournamentId;
    // MongoDB sessions do not support parallel operations inside a transaction.
    const rounds = await AuctionRound.find({ auctionId }).sort({ order: 1 }).session(session);
    const players = await TournamentPlayer.find({ tournamentId, status: REGISTRATION_STATUS.APPROVED })
      .session(session).populate('playerId');
    const teams = await TournamentTeam.find({ tournamentId }).session(session)
      .populate([{ path: 'franchiseId', ordered: true }, { path: 'ownerId', select: 'name', ordered: true }]);
    const bidHistory = await Bid.find({ auctionId }).sort({ placedAt: -1, _id: -1 }).limit(100)
      .session(session).populate('tournamentTeamId', 'name');
    const undoAction = await AuctionCommandService.latest(auction, session);

    const liveState = auction.liveState || {};

    const elapsedSeconds = liveState.updatedAt
      ? (Date.now() - new Date(liveState.updatedAt).getTime()) / 1000
      : 0;
    const trueRemaining =
      auction.status === AUCTION_STATUS.LIVE && liveState.lotStatus === LOT_STATUS.BIDDING
        ? Math.max(0, (liveState.remainingTimeSeconds ?? 0) - Math.max(0, elapsedSeconds))
        : (liveState.remainingTimeSeconds ?? 0);

    return {
      auction,
      auctionConfiguration: auction.auctionConfiguration ?? null,
      undoAction,
      lastUndoVersion: auction.lastUndoVersion ?? 0,
      rounds,
      players,
      franchises: teams,
      bidHistory,
      logs: [...auction.logs].reverse(),
      status: auction.status,
      currentRoundId: liveState.currentRoundId ?? null,
      currentPlayerId: liveState.currentTournamentPlayerId ?? null,
      currentBid: {
        amount: liveState.currentHighestBid ?? 0,
        teamId: liveState.highestBidderTeamId ?? null,
      },
      timer: {
        remaining: trueRemaining,
        total: liveState.timerTotalSeconds || auction.lotTimerSeconds || auction.auctionConfiguration?.lotTimerSeconds,
        isRunning:
          auction.status === AUCTION_STATUS.LIVE && liveState.lotStatus === LOT_STATUS.BIDDING && trueRemaining > 0,
      },
      lotStatus: liveState.lotStatus ?? LOT_STATUS.PENDING,
      version: liveState.version ?? 0,
      viewerCount: 0, // populated outside the transaction
      generatedAt: new Date(),
    };
  }

  /** Resolve one pass, then create at most ONE successor in the same journal. */
  static async checkRoundCompletion(roundId, session, outbox, journal) {
    if (!session || !outbox || !journal) throw new Error('Round progression requires an audited command transaction');
    const round = await AuctionRound.findById(roundId).session(session);
    if (!round || round.status === ROUND_STATUS.COMPLETED) return round;
    // UNSOLD is terminal for a pass, but NEVER terminal for the auction.
    const terminal = [LOT_OUTCOME.SOLD, LOT_OUTCOME.UNSOLD, LOT_OUTCOME.PERMANENT_UNSOLD];
    const unresolved = await TournamentPlayer.countDocuments({
      _id: { $in: round.playerIds }, lotOutcome: { $nin: terminal },
    }).session(session);
    if (unresolved > 0) return round;
    const auction = assertFound(await Auction.findById(round.auctionId).session(session), 'Auction not found');
    const groups = await TournamentPlayer.aggregate([
      { $match: { _id: { $in: round.playerIds }, tournamentId: auction.tournamentId, status: REGISTRATION_STATUS.APPROVED } },
      { $group: { _id: '$lotOutcome', count: { $sum: 1 } } },
    ]).session(session);
    if (!round.playerIds.length || groups.reduce((total, group) => total + group.count, 0) !== round.playerIds.length) {
      throw new AppError('Round membership changed outside the auction. Review unavailable players before closing this pass.', 409);
    }
    const count = (outcome) => groups.find((group) => group._id === outcome)?.count ?? 0;
    journal.track(round);
    round.outcomeSummary = { sold: count(LOT_OUTCOME.SOLD), unsold: count(LOT_OUTCOME.UNSOLD), permanentUnsold: count(LOT_OUTCOME.PERMANENT_UNSOLD) };
    round.status = ROUND_STATUS.COMPLETED;
    round.completedAt = new Date();
    await round.save({ session });
    outbox.push(() => emitRoundCompleted(round._id, round.auctionId, { round }));

    // Unused empty draft rounds do not block the unsold phase. Later nonempty
    // normal rounds still have to run before the first unsold pass is generated.
    const unfinished = await AuctionRound.exists({
      auctionId: round.auctionId, status: { $ne: ROUND_STATUS.COMPLETED }, 'playerIds.0': { $exists: true },
    }).session(session);
    if (unfinished) return round;
    const unsold = await TournamentPlayer.find({
      tournamentId: auction.tournamentId, status: REGISTRATION_STATUS.APPROVED, lotOutcome: LOT_OUTCOME.UNSOLD,
    }).select('_id').sort({ _id: 1 }).session(session).lean();
    if (unsold.length) await AuctionService.createUnsoldRound(auction, unsold.map((player) => player._id), session, outbox, journal);
    else await AuctionService.maybeCompleteAuction(auction, session, outbox, journal);
    return round;
  }

  static async createUnsoldRound(auction, unsoldPlayerIds, session, outbox, journal) {
    if (!session || !outbox || !journal) throw new Error('Unsold passes require an audited command transaction');
    const existing = await AuctionRound.findOne({
      auctionId: auction._id, type: ROUND_TYPE.UNSOLD, status: { $in: [ROUND_STATUS.PENDING, ROUND_STATUS.ACTIVE] },
    }).session(session);
    if (existing) return existing;
    if (!unsoldPlayerIds.length || auction.liveState.lotStatus === LOT_STATUS.BIDDING) throw new AppError('Finish the active pass before relisting players', 409);
    const lastRound = await AuctionRound.findOne({ auctionId: auction._id }).sort({ order: -1 }).select('order').session(session);
    const lastPass = await AuctionRound.findOne({ auctionId: auction._id, type: ROUND_TYPE.UNSOLD }).sort({ unsoldPass: -1 }).select('unsoldPass').session(session);
    const legacyCount = await AuctionRound.countDocuments({ auctionId: auction._id, type: ROUND_TYPE.UNSOLD }).session(session);
    const unsoldPass = Math.max(lastPass?.unsoldPass ?? 0, legacyCount) + 1;
    const [round] = await AuctionRound.create([{
      auctionId: auction._id, name: `Unsold Round-${unsoldPass}`, unsoldPass,
      order: (lastRound?.order ?? 0) + 1, type: ROUND_TYPE.UNSOLD, category: 'UNSOLD',
      playerIds: unsoldPlayerIds, status: ROUND_STATUS.PENDING,
    }], { session });
    journal.created(round);
    const resetting = await TournamentPlayer.find({
      _id: { $in: unsoldPlayerIds }, tournamentId: auction.tournamentId,
      status: REGISTRATION_STATUS.APPROVED, lotOutcome: LOT_OUTCOME.UNSOLD,
    }).session(session);
    if (resetting.length !== unsoldPlayerIds.length) throw new AppError('Unsold inventory changed. Refresh before advancing the pass.', 409);
    for (const player of resetting) journal.track(player);
    await TournamentPlayer.updateMany({ _id: { $in: unsoldPlayerIds } }, {
      $set: { lotOutcome: LOT_OUTCOME.NOT_LISTED, auctionRoundId: round._id },
    }, { session });
    auction.liveState.currentRoundId = round._id;
    auction.liveState.updatedAt = new Date();
    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.UNSOLD_ROUND_CREATED,
      message: `${round.name} created with ${unsoldPlayerIds.length} players`,
      metadata: { roundId: round._id, unsoldPass, playerCount: unsoldPlayerIds.length },
    });
    await auction.save({ session });
    // Relisted IDs let connected clients expose the new queue immediately,
    // without waiting for (or bypassing) a throttled reconciliation snapshot.
    outbox.push(() => emitRoundAdded(auction._id, {
      round, addedBy: 'SYSTEM', relistedPlayerIds: unsoldPlayerIds, liveState: auction.liveState,
    }));
    return round;
  }

  /** Explicit, audited repair for a legacy pass already stalled with UNSOLD results. */
  static async advanceUnsoldPass(auctionId, roundId, user, expected = {}) {
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.MARK_PERMANENT_UNSOLD,
      kind: 'UNSOLD_PASS_ADVANCED', label: 'Continue completed unsold pass',
    }, async ({ auction, session, outbox, journal }) => {
      if (auction.liveState.lotStatus === LOT_STATUS.BIDDING) throw new AppError('Settle the active lot before continuing the pass', 409);
      const round = await AuctionService.runningRound(auctionId, session);
      if (!round || round.type !== ROUND_TYPE.UNSOLD || String(round._id) !== String(roundId)) throw new AppError('The running unsold pass changed. Refresh before continuing.', 409);
      assertLotTarget(auction, { ...expected, roundId }, null, round._id);
      // Persist this command's revision before a helper loads another Auction
      // instance; otherwise relist frames could carry the previous revision.
      await auction.save({ session });
      const closed = await AuctionService.checkRoundCompletion(round._id, session, outbox, journal);
      if (closed.status !== ROUND_STATUS.COMPLETED) throw new AppError('Offer or permanently retire the remaining players before continuing this pass', 409);
    });
    return command.auction;
  }

  static async maybeCompleteAuction(auction, session = null, outbox = null, journal = null) {
  // Defensive invariant: no player may remain in a non-terminal state.
    const dangling = await TournamentPlayer.countDocuments({
      tournamentId: auction.tournamentId,
      status: REGISTRATION_STATUS.APPROVED,
      lotOutcome: { $in: [LOT_OUTCOME.NOT_LISTED, LOT_OUTCOME.IN_PROGRESS, LOT_OUTCOME.UNSOLD] },
    }).session(session ?? null);

    if (dangling > 0) {
      throw new AppError(
        `Auction cannot complete: ${dangling} player(s) are still unresolved`,
        400
      );
    }

    const tournament = await Tournament.findById(auction.tournamentId).session(session ?? null);

    const ownsSession = !session;
    const sess = session ?? (await mongoose.startSession());
    if (ownsSession) sess.startTransaction();

    try {
      journal?.track(auction);
      journal?.track(tournament);
      await auction.transitionTo(AUCTION_STATUS.COMPLETED, sess);
      auction.completedAt = new Date();
      auction.liveState.lotStatus = LOT_STATUS.PENDING;
      auction.logs.push({
        action: AUCTION_LOG_ACTIONS.AUCTION_COMPLETED,
        message: 'Auction automatically completed — all players sold or permanently unsold',
      });
      await auction.save({ session: sess });
      await tournament.transitionTo(TOURNAMENT_STATUS.AUCTION_COMPLETED, sess);

      if (ownsSession) await sess.commitTransaction();

      const publish = () =>
        emitAuctionCompleted(auction._id, {
          auction,
          completedBy: 'SYSTEM',
        });
      if (ownsSession) publish();
      else if (outbox) outbox.push(publish);

      return auction;
    } catch (error) {
      if (ownsSession) await sess.abortTransaction();
    // If another worker already completed it (VersionError), swallow gracefully.
      if (ownsSession && (error.code === 'INVALID_TRANSITION' || error.name === 'VersionError')) {
        return Auction.findById(auction._id);
      }
      throw error;
    } finally {
      if (ownsSession) sess.endSession();
    }
  }

  static async markPermanentUnsold(auctionId, tournamentPlayerId, user, expected = {}) {
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.MARK_PERMANENT_UNSOLD,
      kind: 'PERMANENT_UNSOLD_MARKED', label: 'Retire player from further unsold passes',
    }, async (scope) => {
      const { auction, journal, session, outbox } = scope;
      const player = assertFound(await TournamentPlayer.findOne({
        _id: tournamentPlayerId, tournamentId: auction.tournamentId, status: REGISTRATION_STATUS.APPROVED,
      }).session(session), 'Tournament player not found');
      const round = await AuctionService.runningRound(auctionId, session);
      if (!round || round.type !== ROUND_TYPE.UNSOLD || String(player.auctionRoundId) !== String(round._id)
        || !round.playerIds.some((id) => String(id) === String(player._id))) {
        throw new AppError('Only players in the running unsold pass may be permanently retired', 409);
      }
      assertLotTarget(auction, { ...expected, tournamentPlayerId }, player._id, round._id);
      let result = player;
      const settlesActiveLot = player.lotOutcome === LOT_OUTCOME.IN_PROGRESS;
      if (settlesActiveLot) {
        if (String(auction.liveState.currentTournamentPlayerId) !== String(player._id)) throw new AppError('This player is not the active lot', 409);
        ({ player: result } = await settleActiveLot(scope, LOT_OUTCOME.PERMANENT_UNSOLD, { ...expected, tournamentPlayerId }));
      } else {
        if (![LOT_OUTCOME.NOT_LISTED, LOT_OUTCOME.UNSOLD].includes(player.lotOutcome)) throw new AppError('Player is already resolved', 409);
        journal.track(player);
        player.lotOutcome = LOT_OUTCOME.PERMANENT_UNSOLD;
        player.permanentUnsoldAt = new Date();
        player.permanentUnsoldBy = user._id;
        await player.save({ session });
        auction.logs.push({ action: AUCTION_LOG_ACTIONS.PERMANENT_UNSOLD_MARKED, userId: user._id,
          message: `Player ${player._id} permanently retired from ${round.name}`, metadata: { tournamentPlayerId, roundId: round._id } });
        await auction.save({ session });
      }
      let finalAuction;
      // Pending-player retirement must NOT stop or rewind another player's clock.
      outbox.push(() => emitLotPermanentUnsold(auctionId, {
        tournamentPlayerId, roundId: round._id, markedBy: user._id,
        ...(settlesActiveLot ? { liveState: finalAuction.liveState } : {}),
      }));
      await AuctionService.checkRoundCompletion(round._id, session, outbox, journal);
      finalAuction = await Auction.findById(auctionId).session(session);
      return result;
    });
    return command.result;
  }

  static async complete(auctionId, user) {
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.COMPLETE_AUCTION,
      kind: 'AUCTION_COMPLETED', label: 'Complete auction',
    }, async ({ auction, tournament, session, outbox }) => {
      const unresolved = await TournamentPlayer.countDocuments({
        tournamentId: auction.tournamentId, status: REGISTRATION_STATUS.APPROVED,
        lotOutcome: { $in: [LOT_OUTCOME.NOT_LISTED, LOT_OUTCOME.IN_PROGRESS, LOT_OUTCOME.UNSOLD] },
      }).session(session);
      if (unresolved) throw new AppError(`Cannot complete auction: ${unresolved} player(s) still unresolved`, 400);
      auction.completedAt = new Date();
      auction.liveState.lotStatus = LOT_STATUS.PENDING;
      auction.logs.push({ action: AUCTION_LOG_ACTIONS.AUCTION_COMPLETED, userId: user._id, message: 'Auction completed' });
      await auction.transitionTo(AUCTION_STATUS.COMPLETED, session);
      if (tournament.status !== TOURNAMENT_STATUS.AUCTION_COMPLETED) await tournament.transitionTo(TOURNAMENT_STATUS.AUCTION_COMPLETED, session);
      outbox.push(() => emitAuctionCompleted(auctionId, { auction, completedBy: user._id }));
    });
    return command.auction;
  }
}
