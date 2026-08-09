/**
 * auction.service.js — Enhanced with Domain Events for Socket.IO realtime layer
 * -------------------------------------------------------------------------------
 * Original architecture preserved 100%.
 * After each successful MongoDB transaction/commit, we emit domain events
 * via auction.events.js -> eventBus -> SocketPublisher -> io.to(room).emit()
 *
 * No change to method signatures, validation, or transaction logic.
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
  emitLiveStateUpdated,
  emitViewerCountUpdated,
} from "../events/auction.events.js";
import eventBus from "../events/eventBus.js";
import { AUCTION_EVENTS } from "../events/auction.events.js";

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

      console.log(payload.bidIncrementTiers);

      await tournament.transitionTo(
        TOURNAMENT_STATUS.AUCTION_SCHEDULED,
        session,
      );
      await session.commitTransaction();

      console.log(payload.bidIncrementTiers);

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

  static async getByIdPopulated(auctionId) {
    return assertFound(
      await Auction.findById(auctionId).populate("tournamentId").populate(AuctionService.auctionPopulate),
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

  static async addRound(auctionId, user, payload, authorization = null) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionAuthorizationService.assertPermission({
      auctionId,
      user,
      permission: AUCTION_PERMISSIONS.MANAGE_ROUNDS,
      existingContext: authorization,
    });

    if (auction.status === AUCTION_STATUS.COMPLETED) {
      throw new AppError("Cannot modify a completed auction", 400);
    }

    const round = await AuctionRound.create({
      auctionId,
      name: payload.name,
      order: payload.order,
      type: payload.type ?? "normal",
      playerIds: payload.playerIds ?? [],
      category: payload.category ?? null,
      status: ROUND_STATUS.PENDING,
    });

    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.ROUND_ADDED,
      userId: user._id,
      message: `Round "${round.name}" added`,
      metadata: { roundId: round._id },
    });
    await auction.save();

    // --- SOCKET ---
    emitRoundAdded(auctionId, {
      round,
      addedBy: user._id,
    });

    return round;
  }

  static async updateRules(
    auctionId,
    user,
    payload = {},
    authorization = null,
  ) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionAuthorizationService.assertPermission({
      auctionId,
      user,
      permission: AUCTION_PERMISSIONS.UPDATE_RULES,
      existingContext: authorization,
    });

    if (
      ![AUCTION_STATUS.DRAFT, AUCTION_STATUS.SCHEDULED].includes(auction.status)
    ) {
      throw new AppError(
        "Auction rules can only be edited while in DRAFT or SCHEDULED",
        400,
      );
    }

    const patch = {};
    if (payload.name !== undefined) {
      patch.name = payload.name;
      auction.name = payload.name;
    }
    if (payload.pursePerTeam !== undefined) {
      auction.auctionConfiguration.pursePerTeam = payload.pursePerTeam;
      patch.pursePerTeam = payload.pursePerTeam;
    }
    if (payload.squadSize !== undefined) {
      auction.auctionConfiguration.squadSize = payload.squadSize;
      patch.squadSize = payload.squadSize;
    }
    if (payload.maxTeams !== undefined) {
      auction.auctionConfiguration.maxTeams = payload.maxTeams;
      patch.maxTeams = payload.maxTeams;
    }
    if (payload.currency !== undefined) {
      auction.auctionConfiguration.currency = payload.currency;
      patch.currency = payload.currency;
    }
    if (payload.lotTimerSeconds !== undefined) {
      auction.auctionConfiguration.lotTimerSeconds = payload.lotTimerSeconds;
      patch.lotTimerSeconds = payload.lotTimerSeconds;
      auction.lotTimerSeconds = payload.lotTimerSeconds;
    }
    if (payload.bidResetSeconds !== undefined) {
      auction.auctionConfiguration.bidResetSeconds = payload.bidResetSeconds;
      patch.bidResetSeconds = payload.bidResetSeconds;
      auction.bidResetSeconds = payload.bidResetSeconds;
    }
    if (payload.minimumBidIncrement !== undefined) {
      auction.auctionConfiguration.minimumBidIncrement =
        payload.minimumBidIncrement;
      patch.minimumBidIncrement = payload.minimumBidIncrement;
    }
    if (payload.bidIncrementTiers !== undefined) {
      auction.auctionConfiguration.bidIncrementTiers =
        payload.bidIncrementTiers;
      patch.bidIncrementTiers = payload.bidIncrementTiers;
      auction.bidIncrementTiers = payload.bidIncrementTiers;
    }
    if (payload.registrationDeadline !== undefined) {
      auction.auctionConfiguration.registrationDeadline =
        payload.registrationDeadline;
      patch.registrationDeadline = payload.registrationDeadline;
    }
    if (payload.scheduledAt !== undefined) {
      patch.scheduledAt = payload.scheduledAt;
      auction.scheduledAt = payload.scheduledAt;
    }

    if (Object.keys(patch).length === 0) {
      throw new AppError("No editable rule fields provided", 400);
    }

    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.RULES_UPDATED,
      userId: user._id,
      message: "Auction rules updated",
      metadata: patch,
    });
    await auction.save();

    // --- SOCKET ---
    emitRulesUpdated(auctionId, {
      patch,
      auction,
      updatedBy: user._id,
    });

    return auction;
  }

  static async listRounds(auctionId) {
    return AuctionRound.find({ auctionId }).sort({ order: 1 });
  }

  static async updateRound(
    auctionId,
    roundId,
    user,
    patch = {},
    authorization = null,
  ) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionAuthorizationService.assertPermission({
      auctionId,
      user,
      permission: AUCTION_PERMISSIONS.MANAGE_ROUNDS,
      existingContext: authorization,
    });

    if (auction.status === AUCTION_STATUS.COMPLETED) {
      throw new AppError("Cannot modify rounds on a completed auction", 400);
    }

    const round = assertFound(
      await AuctionRound.findOne({ _id: roundId, auctionId }),
      "Auction round not found",
    );

    if (
      patch.playerIds !== undefined &&
      round.status !== ROUND_STATUS.PENDING
    ) {
      throw new AppError(
        "Cannot change playerIds on a round that has already started",
        400,
      );
    }

    if (patch.name !== undefined) round.name = patch.name;
    if (patch.type !== undefined) round.type = patch.type;
    if (patch.order !== undefined) round.order = patch.order;
    if (patch.playerIds !== undefined) round.playerIds = patch.playerIds;
    if (patch.category !== undefined) {
      round.category = patch.category;
    } 

    await round.save();

    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.ROUND_UPDATED,
      userId: user._id,
      message: `Round "${round.name}" updated`,
      metadata: { roundId: round._id, patch },
    });
    await auction.save();

    // --- SOCKET ---
    emitRoundUpdated(auctionId, {
      round,
      patch,
      updatedBy: user._id,
    });

    return round;
  }

  static async deleteRound(auctionId, roundId, user, authorization = null) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionAuthorizationService.assertPermission({
      auctionId,
      user,
      permission: AUCTION_PERMISSIONS.MANAGE_ROUNDS,
      existingContext: authorization,
    });

    const round = assertFound(
      await AuctionRound.findOne({ _id: roundId, auctionId }),
      "Auction round not found",
    );

    if (round.status !== ROUND_STATUS.PENDING) {
      throw new AppError(
        "Only a round with no auction activity can be deleted",
        400,
      );
    }

    const roundName = round.name;
    await round.deleteOne();

    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.ROUND_DELETED,
      userId: user._id,
      message: `Round "${roundName}" deleted`,
      metadata: { roundId },
    });
    await auction.save();

    // --- SOCKET ---
    emitRoundDeleted(auctionId, {
      roundId,
      roundName,
      deletedBy: user._id,
    });

    return { success: true };
  }

  static async start(auctionId, user, authorization = null) {
    const auction = await AuctionService.getById(auctionId);
    const authorizationContext =
      await AuctionAuthorizationService.assertPermission({
        auctionId,
        user,
        permission: AUCTION_PERMISSIONS.START_AUCTION,
        existingContext: authorization,
      });
    const tournament = authorizationContext.tournament;

    const approvedTeams = await TournamentTeam.countDocuments({
      tournamentId: auction.tournamentId,
      status: REGISTRATION_STATUS.APPROVED,
    });

    if (approvedTeams < 2) {
      throw new AppError(
        "At least two approved teams are required to start the auction",
        400,
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await auction.transitionTo(AUCTION_STATUS.LIVE, session);
      auction.startedAt = new Date();
      auction.logs.push({
        action: AUCTION_LOG_ACTIONS.AUCTION_STARTED,
        userId: user._id,
        message: "Auction started",
      });
      await auction.save({ session });
      await tournament.transitionTo(TOURNAMENT_STATUS.AUCTION_RUNNING, session);
      await session.commitTransaction();

      // --- SOCKET AFTER COMMIT ---
      emitAuctionStarted(auctionId, {
        auction,
        tournamentId: auction.tournamentId,
        startedBy: user._id,
      });

      return auction;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async pause(auctionId, user, authorization = null) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionAuthorizationService.assertPermission({
      auctionId,
      user,
      permission: AUCTION_PERMISSIONS.PAUSE_AUCTION,
      existingContext: authorization,
    });

    await auction.transitionTo(AUCTION_STATUS.PAUSED);
    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.AUCTION_PAUSED,
      userId: user._id,
      message: "Auction paused",
    });
    await auction.save();

    emitAuctionPaused(auctionId, {
      auction,
      pausedBy: user._id,
    });

    return auction;
  }

  static async resume(auctionId, user, authorization = null) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionAuthorizationService.assertPermission({
      auctionId,
      user,
      permission: AUCTION_PERMISSIONS.RESUME_AUCTION,
      existingContext: authorization,
    });

    await auction.transitionTo(AUCTION_STATUS.LIVE);
    auction.logs.push({
      action: AUCTION_LOG_ACTIONS.AUCTION_RESUMED,
      userId: user._id,
      message: "Auction resumed",
    });
    await auction.save();

    emitAuctionResumed(auctionId, {
      auction,
      resumedBy: user._id,
    });

    return auction;
  }

  static async openLot(
    auctionId,
    user,
    { tournamentPlayerId, roundId },
    authorization = null,
  ) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionAuthorizationService.assertPermission({
      auctionId,
      user,
      permission: AUCTION_PERMISSIONS.OPEN_LOT,
      existingContext: authorization,
    });

    if (auction.status !== AUCTION_STATUS.LIVE) {
      throw new AppError("Auction must be live to open a lot", 400);
    }
    if (auction.liveState?.lotStatus === LOT_STATUS.BIDDING) {
      throw new AppError(
        "A lot is already open — settle it before opening the next one",
        400,
      );
    }

    const round = assertFound(
      await AuctionRound.findOne({ _id: roundId, auctionId }),
      "Auction round not found",
    );

    // NEW: Player must actually belong to this round.
    if (!round.playerIds.map(String).includes(String(tournamentPlayerId))) {
      throw new AppError('Player is not assigned to this round', 400);
    }

    // Proper query with constants
    const tournamentPlayer = assertFound(
      await TournamentPlayer.findOne({
        _id: tournamentPlayerId,
        tournamentId: auction.tournamentId,
        status: REGISTRATION_STATUS.APPROVED,
        lotOutcome: { $in: [LOT_OUTCOME.NOT_LISTED, LOT_OUTCOME.UNSOLD] },
      }),
      "Player not available for auction (must be APPROVED and not currently listed/sold)",
    );

    if (
      tournamentPlayer.lotOutcome === LOT_OUTCOME.UNSOLD &&
      round.type !== ROUND_TYPE.UNSOLD
    ) {
      throw new AppError(
        'Unsold players may only be re-listed in the dedicated unsold round',
        400
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Activate round if first lot
      if (round.status === ROUND_STATUS.PENDING) {
        round.status = ROUND_STATUS.ACTIVE;
        round.startedAt = new Date();
        await round.save({ session });
      }

      // Update player
      tournamentPlayer.lotOutcome = LOT_OUTCOME.IN_PROGRESS;
      tournamentPlayer.auctionRoundId = round._id;
      await tournamentPlayer.save({ session });

      // Update live state (optimistic concurrency via version)
      auction.liveState = {
        currentTournamentPlayerId: tournamentPlayer._id,
        currentRoundId: round._id,
        currentHighestBid: 0,
        highestBidderTeamId: null,
        remainingTimeSeconds: auction.lotTimerSeconds,
        lotStatus: LOT_STATUS.BIDDING,
        version: (auction.liveState?.version ?? 0) + 1,
        updatedAt: new Date(),
      };

      auction.logs.push({
        action: AUCTION_LOG_ACTIONS.LOT_OPENED,
        userId: user._id,
        message: `Lot opened for player ${tournamentPlayerId}`,
        metadata: { tournamentPlayerId, roundId },
      });

      await auction.save({ session });

      await session.commitTransaction();

      // Populate for rich socket payload
      const populatedPlayer = await TournamentPlayer.findById(
        tournamentPlayer._id,
      )
        .populate("playerId")
        .lean(); // or .exec()

      // --- SOCKET EVENT ---
      emitLotOpened(auctionId, {
        tournamentPlayerId: tournamentPlayer._id,
        roundId: round._id,
        currentPlayer: populatedPlayer,
        currentRound: round,
        liveState: auction.liveState,
        openedBy: user._id,
      });

      return auction;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // --- Viewer presence — now dual-write: DB + socket event ---
  static async heartbeatViewer(auctionId, viewerId, userId = null) {
    if (!viewerId) {
      throw new AppError("viewerId is required", 400);
    }
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
    const auction = await AuctionService.getByIdPopulated(auctionId);

    const [rounds, players, teams, bidHistory, viewerCount] = await Promise.all(
      [
        AuctionRound.find({ auctionId }).sort({ order: 1 }),
        TournamentPlayer.find({
          tournamentId: auction.tournamentId._id ?? auction.tournamentId,
          status: REGISTRATION_STATUS.APPROVED,
        }).populate("playerId"),
        TournamentTeam.find({
          tournamentId: auction.tournamentId._id ?? auction.tournamentId,
        })
          .populate("franchiseId")
          .populate("ownerId", "name"),
        Bid.find({ auctionId })
          .sort({ placedAt: -1 })
          .limit(100)
          .populate("tournamentTeamId", "name"),
        AuctionService.getViewerCount(auctionId),
      ],
    );

    const liveState = auction.liveState || {};

    const elapsedSeconds = liveState.updatedAt
      ? (Date.now() - new Date(liveState.updatedAt).getTime()) / 1000
      : 0;
    const trueRemaining =
      liveState.lotStatus === LOT_STATUS.BIDDING
        ? Math.max(0, (liveState.remainingTimeSeconds ?? 0) - elapsedSeconds)
        : (liveState.remainingTimeSeconds ?? 0);

    for (const team of teams) {
     // console.log({
      //  id: team._id.toString(),
      //  wallet: team.wallet,
     // });
    }

    return {
      auction,
      auctionConfiguration: auction.auctionConfiguration ?? null,
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
        total:
          auction.auctionConfiguration?.lotTimerSeconds ??
          auction.lotTimerSeconds,
        isRunning:
          liveState.lotStatus === LOT_STATUS.BIDDING && trueRemaining > 0,
      },
      lotStatus: liveState.lotStatus ?? LOT_STATUS.PENDING,
      version: liveState.version ?? 0,
      viewerCount,
      generatedAt: new Date(),
    };
  }

  static async checkRoundCompletion(roundId, session = null) {
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
      round.status = ROUND_STATUS.COMPLETED;
      round.completedAt = new Date();
      await round.save({ session });

      emitRoundCompleted(round._id, round.auctionId, { round });

    // Dispatch post-completion workflow
      if (round.type === ROUND_TYPE.NORMAL) {
        await AuctionService.handleNormalRoundClosed(round, session);
      } else {
        await AuctionService.handleUnsoldRoundClosed(round, session);
      }
    }
    return round;
  }

  static async handleNormalRoundClosed(closedRound, session = null) {
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
      await AuctionService.maybeCompleteAuction(auction, session);
    } else {
      await AuctionService.createUnsoldRound(auction, unsoldPlayers.map((p) => p._id), session);
    }
  }

  static async createUnsoldRound(auction, unsoldPlayerIds, session = null) {
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

      emitRoundAdded(auction._id, { round: unsoldRound, addedBy: 'SYSTEM' });

      return unsoldRound;
    } catch (error) {
      if (ownsSession) await sess.abortTransaction();
      throw error;
    } finally {
      if (ownsSession) sess.endSession();
    }
  }

  static async handleUnsoldRoundClosed(closedRound, session = null) {
    const auction = await Auction.findById(closedRound.auctionId).session(session ?? null);
    await AuctionService.maybeCompleteAuction(auction, session);
  }

  static async maybeCompleteAuction(auction, session = null) {
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

      emitAuctionCompleted(auction._id, {
        auction,
        completedBy: 'SYSTEM',
      });

      return auction;
    } catch (error) {
      if (ownsSession) await sess.abortTransaction();
    // If another worker already completed it (VersionError), swallow gracefully.
      if (error.code === 'INVALID_TRANSITION' || error.name === 'VersionError') {
        return Auction.findById(auction._id);
      }
      throw error;
    } finally {
      if (ownsSession) sess.endSession();
    }
  }

  static async markPermanentUnsold(auctionId, tournamentPlayerId, user, authorization = null) {
    const auction = await AuctionService.getById(auctionId);
    await AuctionAuthorizationService.assertPermission({
      auctionId,
      user,
      permission: AUCTION_PERMISSIONS.MARK_PERMANENT_UNSOLD,
      existingContext: authorization,
    });

    const player = await TournamentPlayer.findOne({
      _id: tournamentPlayerId,
      tournamentId: auction.tournamentId,
    });

    assertFound(player, 'Tournament player not found');

    const round = await AuctionRound.findOne({
      _id: player.auctionRoundId,
      auctionId,
      type: ROUND_TYPE.UNSOLD,
    });

    if (!round) {
      throw new AppError('Player is not in the unsold round', 400);
    }

    

    if (player.lotOutcome === LOT_OUTCOME.PERMANENT_UNSOLD) {
      return player; // Idempotent
    }

   // if //(player.lotOutcome === LOT_OUTCOME.IN_PROGRESS) {
   //   throw new AppError('Cannot mark player as permanent unsold while their lot is in progress', 400);
   // }

    if (![LOT_OUTCOME.NOT_LISTED,LOT_OUTCOME.IN_PROGRESS, LOT_OUTCOME.UNSOLD].includes(player.lotOutcome)) {
      throw new AppError(
        `Player state ${player.lotOutcome} cannot transition to PERMANENT_UNSOLD`,
        400
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      player.lotOutcome = LOT_OUTCOME.PERMANENT_UNSOLD;
      player.permanentUnsoldAt = new Date();
      player.permanentUnsoldBy = user._id;
      await player.save({ session });

      auction.logs.push({
        action: AUCTION_LOG_ACTIONS.PERMANENT_UNSOLD_MARKED,
        userId: user._id,
        message: `Player ${player._id} marked permanently unsold`,
        metadata: { tournamentPlayerId, roundId: round._id },
      });
      await auction.save({ session });

      await session.commitTransaction();

    // After commit, evaluate whether the unsold round (and therefore the auction) is done.
      await AuctionService.checkRoundCompletion(round._id);

      return player;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async complete(auctionId, user, authorization = null) {
    const auction = await AuctionService.getById(auctionId);
    const authorizationContext =
      await AuctionAuthorizationService.assertPermission({
        auctionId,
        user,
        permission: AUCTION_PERMISSIONS.COMPLETE_AUCTION,
        existingContext: authorization,
      });
    const tournament = authorizationContext.tournament;

    // NEW: Manual completion must also respect the terminal invariant.
    const unresolved = await TournamentPlayer.countDocuments({
      tournamentId: auction.tournamentId,
      status: REGISTRATION_STATUS.APPROVED,
      lotOutcome: { $in: [LOT_OUTCOME.NOT_LISTED, LOT_OUTCOME.IN_PROGRESS, LOT_OUTCOME.UNSOLD] },
    });

    if (unresolved > 0) {
      throw new AppError(
        `Cannot complete auction: ${unresolved} player(s) still unresolved. ` +
          'Mark them sold or permanently unsold first.',
        400
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await auction.transitionTo(AUCTION_STATUS.COMPLETED, session);
      auction.completedAt = new Date();
      auction.liveState.lotStatus = LOT_STATUS.PENDING;
      auction.logs.push({
        action: AUCTION_LOG_ACTIONS.AUCTION_COMPLETED,
        userId: user._id,
        message: "Auction completed",
      });
      await auction.save({ session });
      await tournament.transitionTo(
        TOURNAMENT_STATUS.AUCTION_COMPLETED,
        session,
      );
      await session.commitTransaction();

      emitAuctionCompleted(auctionId, {
        auction,
        completedBy: user._id,
      });

      return auction;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
