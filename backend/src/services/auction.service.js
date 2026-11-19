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
      const tournamentPlayer = assertFound(await TournamentPlayer.findOne({
        _id: tournamentPlayerId, tournamentId: auction.tournamentId, status: REGISTRATION_STATUS.APPROVED,
        lotOutcome: { $in: round.type === ROUND_TYPE.UNSOLD ? [LOT_OUTCOME.NOT_LISTED, LOT_OUTCOME.UNSOLD] : [LOT_OUTCOME.NOT_LISTED] },
      }).session(session), 'Player is no longer eligible for this lot');
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

  static async checkRoundCompletion(roundId, session = null, outbox = null, journal = null) {
    const round = await AuctionRound.findById(roundId).session(session ?? null);
    if (!round || round.status === ROUND_STATUS.COMPLETED) return round;

  // Strategy: terminal outcomes depend on round type.
  // Normal round  → SOLD or UNSOLD is fine.
  // Unsold round  → only SOLD or PERMANENT_UNSOLD resolves the auction.
    const terminalOutcomes =
      round.type === ROUND_TYPE.UNSOLD
        ? [LOT_OUTCOME.SOLD, LOT_OUTCOME.PERMANENT_UNSOLD]
        : [LOT_OUTCOME.SOLD, LOT_OUTCOME.UNSOLD];

    const unresolvedCount = await TournamentPlayer.countDocuments({
      _id: { $in: round.playerIds },
      lotOutcome: { $nin: terminalOutcomes },
    }).session(session ?? null);

    if (unresolvedCount === 0) {
      journal?.track(round);
      round.status = ROUND_STATUS.COMPLETED;
      round.completedAt = new Date();
      await round.save({ session });

    // Domain events must only fire AFTER the owning transaction commits.
    // When this runs inside someone else's transaction (settleLot), the
    // caller passes an outbox array that it drains post-commit; when this
    // runs standalone (markPermanentUnsold path), we're already outside
    // any transaction, so emitting immediately is safe.
      const emitNowOrDefer = (fn) => (outbox ? outbox.push(fn) : fn());
      emitNowOrDefer(() => emitRoundCompleted(round._id, round.auctionId, { round }));

    // Dispatch post-completion workflow
      if (round.type === ROUND_TYPE.NORMAL) {
        await AuctionService.handleNormalRoundClosed(round, session, outbox, journal);
      } else {
        await AuctionService.handleUnsoldRoundClosed(round, session, outbox, journal);
      }
    }
    return round;
  }

  static async handleNormalRoundClosed(closedRound, session = null, outbox = null, journal = null) {
  // Idempotency: if any normal round is still open, do nothing.
    const pendingNormal = await AuctionRound.countDocuments({
      auctionId: closedRound.auctionId,
      type: ROUND_TYPE.NORMAL,
      status: { $ne: ROUND_STATUS.COMPLETED },
    }).session(session ?? null);

    if (pendingNormal > 0) return;

    const auction = await Auction.findById(closedRound.auctionId).session(session ?? null);

  // Find every player who went unsold across all normal rounds.
    const unsoldPlayers = await TournamentPlayer.find({
      tournamentId: auction.tournamentId,
      lotOutcome: LOT_OUTCOME.UNSOLD,
    })
      .session(session ?? null)
      .select('_id')
      .lean();

    if (unsoldPlayers.length === 0) {
    // No residual inventory → auction can close immediately.
      await AuctionService.maybeCompleteAuction(auction, session, outbox, journal);
    } else {
      await AuctionService.createUnsoldRound(auction, unsoldPlayers.map((p) => p._id), session, outbox, journal);
    }
  }

  static async createUnsoldRound(auction, unsoldPlayerIds, session = null, outbox = null, journal = null) {
    const ownsSession = !session;
    const sess = session ?? (await mongoose.startSession());

    if (ownsSession) sess.startTransaction();

    try {
    // Race-guard: another worker may have already created it.
      const existing = await AuctionRound.findOne({
        auctionId: auction._id,
        type: ROUND_TYPE.UNSOLD,
      }).session(sess);

      if (existing) {
        if (ownsSession) await sess.commitTransaction();
        return existing;
      }

      const lastRound = await AuctionRound.findOne({ auctionId: auction._id })
        .sort({ order: -1 })
        .session(sess)
        .select('order');

      const [unsoldRound] = await AuctionRound.create(
        [
          {
            auctionId: auction._id,
            name: 'Unsold Players Round',
            order: (lastRound?.order ?? 0) + 1,
            type: ROUND_TYPE.UNSOLD,
            category: "UNSOLD",
            playerIds: unsoldPlayerIds,
            status: ROUND_STATUS.PENDING,
          },
        ],
        { session: sess }
      );
  
      journal?.created(unsoldRound);
      if (journal) {
        const resetting = await TournamentPlayer.find({ _id: { $in: unsoldPlayerIds } }).session(sess);
        for (const player of resetting) journal.track(player);
      }

    // Reset players so the existing `openLot` machinery can re-use them
    // without any special-casing.
      await TournamentPlayer.updateMany(
        { _id: { $in: unsoldPlayerIds } },
        {
          $set: {
            lotOutcome: LOT_OUTCOME.NOT_LISTED,
            auctionRoundId: unsoldRound._id,
          },
        },
        { session: sess }
      );

      auction.logs.push({
        action: AUCTION_LOG_ACTIONS.UNSOLD_ROUND_CREATED,
        message: `Unsold round created with ${unsoldPlayerIds.length} players`,
        metadata: { roundId: unsoldRound._id, playerCount: unsoldPlayerIds.length },
      });
      await auction.save({ session: sess });

      if (ownsSession) await sess.commitTransaction();

      // Only publish once the round actually exists in the committed
      // transaction — if we joined a caller's transaction, hand the
      // emission to their post-commit outbox.
      const publish = () =>
        emitRoundAdded(auction._id, { round: unsoldRound, addedBy: 'SYSTEM' });
      if (ownsSession) publish();
      else if (outbox) outbox.push(publish);

      return unsoldRound;
    } catch (error) {
      if (ownsSession) await sess.abortTransaction();
      throw error;
    } finally {
      if (ownsSession) sess.endSession();
    }
  }

  static async handleUnsoldRoundClosed(closedRound, session = null, outbox = null, journal = null) {
    const auction = await Auction.findById(closedRound.auctionId).session(session ?? null);
    await AuctionService.maybeCompleteAuction(auction, session, outbox, journal);
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

  static async markPermanentUnsold(auctionId, tournamentPlayerId, user) {
    const command = await AuctionCommandService.run({
      auctionId, user, permission: AUCTION_PERMISSIONS.MARK_PERMANENT_UNSOLD,
      kind: 'PERMANENT_UNSOLD_MARKED', label: 'Retire player from unsold pool',
    }, async ({ auction, journal, session, outbox }) => {
      const player = assertFound(await TournamentPlayer.findOne({ _id: tournamentPlayerId, tournamentId: auction.tournamentId, status: REGISTRATION_STATUS.APPROVED }).session(session), 'Tournament player not found');
      const round = await AuctionRound.findOne({ _id: player.auctionRoundId, auctionId, type: ROUND_TYPE.UNSOLD }).session(session);
      if (!round || !round.playerIds.some((id) => String(id) === String(player._id))) throw new AppError('Player is not in the unsold round', 400);
      if (![LOT_OUTCOME.NOT_LISTED, LOT_OUTCOME.UNSOLD].includes(player.lotOutcome)) throw new AppError('Settle the active lot before retiring the player', 400);
      journal.track(player);
      player.lotOutcome = LOT_OUTCOME.PERMANENT_UNSOLD;
      player.permanentUnsoldAt = new Date();
      player.permanentUnsoldBy = user._id;
      await player.save({ session });
      auction.logs.push({ action: AUCTION_LOG_ACTIONS.PERMANENT_UNSOLD_MARKED, userId: user._id,
        message: `Player ${player._id} retired from the unsold pool`, metadata: { tournamentPlayerId, roundId: round._id } });
      await auction.save({ session });
      await AuctionService.checkRoundCompletion(round._id, session, outbox, journal);
      outbox.push(() => emitLotPermanentUnsold(auctionId, { tournamentPlayerId, roundId: round._id, markedBy: user._id }));
      return player;
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
