// registration.service.js
import mongoose from 'mongoose';
import { TournamentPlayer } from '../models/TournamentPlayer.js';
import { TournamentTeam } from '../models/TournamentTeam.js';
import { Player } from '../models/Player.js';
import { Tournament } from '../models/Tournament.js';
import { AppError, assertFound, parsePagination, buildPaginatedResponse } from '../utils/helpers.js';
import { REGISTRATION_STATUS, NOTIFICATION_TYPES, LOT_OUTCOME } from '../config/constants.js';
import { TournamentService } from './tournament.service.js';
import { FranchiseService } from './franchise.service.js';
import { NotificationService } from './notification.service.js';

export class RegistrationService {

  // ====================== USER ID RESOLUTION ======================
  /**
   * Resolves the magic string 'me' to the actual authenticated user ID.
   * Controllers should pass req.user._id (or equivalent) as currentUserId.
   */
  static resolveUserId(queryValue, currentUserId) {
    if (!queryValue) return undefined;
    return queryValue === 'me' ? currentUserId : queryValue;
  }

  // ====================== COUNT HELPERS ======================
  // Counting strategy:
  //   • Increment when a player/team is REGISTERED (status becomes PENDING).
  //   • Decrement when a player/team is REJECTED (any status → REJECTED).
  //   • No count change on verify/approve (already counted at registration).
  //   • No count change on duplicate verify/approve (idempotent).

  static async incrementPlayersCount(tournamentId, session) {
    const options = session ? { session } : {};
    await Tournament.findByIdAndUpdate(tournamentId, { $inc: { playersCount: 1 } }, options);
  }

  static async decrementPlayersCount(tournamentId, session) {
    const options = session ? { session } : {};
    await Tournament.findByIdAndUpdate(tournamentId, { $inc: { playersCount: -1 } }, options);
  }

  static async incrementTeamsCount(tournamentId, session) {
    const options = session ? { session } : {};
    await Tournament.findByIdAndUpdate(tournamentId, { $inc: { teamsCount: 1 } }, options);
  }

  static async decrementTeamsCount(tournamentId, session) {
    const options = session ? { session } : {};
    await Tournament.findByIdAndUpdate(tournamentId, { $inc: { teamsCount: -1 } }, options);
  }

  // ====================== PLAYERS ======================

  static async registerPlayer(tournamentId, userId, payload = {}) {
    const tournament = await TournamentService.getById(tournamentId);

    if (!tournament.playerRegistrationOpen) {
      throw new AppError('Player registration is closed for this tournament', 400);
    }

    const player = await Player.findOne({ userId });
    assertFound(player, 'Create a player profile before registering');

    const existing = await TournamentPlayer.findOne({ tournamentId, playerId: player._id });
    if (existing) {
      throw new AppError('Already registered for this tournament', 409);
    }

    const registration = await TournamentPlayer.create({
      tournamentId,
      playerId: player._id,
      userId,
      basePrice: payload.basePrice ?? 100_000,
      category: payload.category,
      primaryRole: payload.primaryRole ?? player.primaryRole,
      status: REGISTRATION_STATUS.PENDING,
      lotOutcome: LOT_OUTCOME.NOT_LISTED,
    });

    // Increment count on every new registration (counts PENDING + APPROVED + REJECTED)
    await RegistrationService.incrementPlayersCount(tournamentId);

    await NotificationService.create({
      userId: tournament.organizerId,
      type: NOTIFICATION_TYPES.REGISTRATION_UPDATE,
      title: 'New player registration',
      message: `${player.fullName} registered for ${tournament.name}`,
      data: { tournamentId, registrationId: registration._id },
    });

    return registration;
  }

  static async verifyPlayer(tournamentId, registrationId, organizer) {
    const tournament = await TournamentService.getById(tournamentId);
    TournamentService.assertOrganizerAccess(tournament, organizer);

    const registration = assertFound(
      await TournamentPlayer.findOne({ _id: registrationId, tournamentId }),
      'Registration not found'
    );

    registration.status = REGISTRATION_STATUS.APPROVED;
    registration.verifiedAt = new Date();
    await registration.save();

    // Count was already incremented at registration time.
    // No additional increment here — prevents double-counting.

    await NotificationService.create({
      userId: registration.userId,
      type: NOTIFICATION_TYPES.REGISTRATION_UPDATE,
      title: 'Registration verified',
      message: `Your registration for ${tournament.name} has been verified`,
      data: { tournamentId },
    });

    return registration;
  }

  static async rejectPlayer(tournamentId, registrationId, organizer, reason) {
    const tournament = await TournamentService.getById(tournamentId);
    TournamentService.assertOrganizerAccess(tournament, organizer);

    const registration = assertFound(
      await TournamentPlayer.findOne({ _id: registrationId, tournamentId }),
      'Registration not found'
    );

    registration.status = REGISTRATION_STATUS.REJECTED;
    registration.rejectedReason = reason;
    await registration.save();

    // Decrement on every rejection (count was incremented at registration)
    await RegistrationService.decrementPlayersCount(tournamentId);

    await NotificationService.create({
      userId: registration.userId,
      type: NOTIFICATION_TYPES.REGISTRATION_UPDATE,
      title: 'Registration rejected',
      message: `Your registration for ${tournament.name} was rejected: ${reason}`,
      data: { tournamentId },
    });

    return registration;
  }

  /**
   * Organizer sets/edits a registered player's base price ahead of the
   * auction. Base price is an auction *input* — once a player has been
   * listed in a round (or sold), it becomes part of the historical
   * auction record, so edits are only allowed while the player is still
   * sitting in the pre-auction pool (lotOutcome === NOT_LISTED and not
   * sold). This intentionally does NOT require the registration to be
   * APPROVED first — organizers commonly set prices in bulk before
   * getting to verification.
   */
  static async setPlayerBasePrice(tournamentId, registrationId, organizer, basePrice) {
    const tournament = await TournamentService.getById(tournamentId);
    TournamentService.assertOrganizerAccess(tournament, organizer);

    if (typeof basePrice !== 'number' || !Number.isFinite(basePrice) || basePrice < 0) {
      throw new AppError('basePrice must be a number greater than or equal to 0', 400);
    }

    const registration = assertFound(
      await TournamentPlayer.findOne({ _id: registrationId, tournamentId }),
      'Registration not found'
    );

    if (registration.lotOutcome !== LOT_OUTCOME.NOT_LISTED || registration.isSold) {
      throw new AppError(
        'Base price can only be changed before the player is listed for auction',
        400
      );
    }

    registration.basePrice = basePrice;
    registration.basePriceUpdatedAt = new Date();
    await registration.save();

    await NotificationService.create({
      userId: registration.userId,
      type: NOTIFICATION_TYPES.REGISTRATION_UPDATE,
      title: 'Base price updated',
      message: `Your base price for ${tournament.name} has been set to ${basePrice}`,
      data: { tournamentId, registrationId: registration._id },
    });

    return registration;
  }

  static async listPlayers(tournamentId, query = {}, currentUserId) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { tournamentId };

    if (query.status) filter.status = query.status;
    if (query.isSold !== undefined) filter.isSold = query.isSold === 'true';
    if (query.lotOutcome) filter.lotOutcome = query.lotOutcome;
    if (query.userId) {
      filter.userId = this.resolveUserId(query.userId, currentUserId);
    }

    const [registrations, total] = await Promise.all([
      TournamentPlayer.find(filter)
        .populate({
          path: "playerId",
          select: "fullName primaryRole profileImage",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      TournamentPlayer.countDocuments(filter),
    ]);

    const data = registrations.map((registration) => ({
      id: registration._id.toString(),
      registrationId: registration._id.toString(),
      playerId: registration.playerId?._id?.toString(),
      name: registration.playerId?.fullName ?? "",
      role: registration.primaryRole,
      basePrice: registration.basePrice,
      basePriceUpdatedAt: registration.basePriceUpdatedAt ?? null,
      status: registration.status,
      lotOutcome: registration.lotOutcome,
      isSold: registration.isSold,
      soldPrice: registration.soldPrice,
      profileImage: registration.playerId?.profileImage ?? null,
      createdAt: registration.createdAt,
    }));

    return buildPaginatedResponse({ data, total, page, limit });
  }

  // ====================== TEAMS ======================

  static async registerTeam(tournamentId, ownerId, { franchiseId }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const tournament = await Tournament.findById(tournamentId).session(session);

      if (!tournament.teamRegistrationOpen) {
        throw new AppError('Team registration is closed for this tournament', 400);
      }

      const franchise = await FranchiseService.getById(franchiseId);
      await FranchiseService.assertOwner(franchise, ownerId);

      const existing = await TournamentTeam.findOne({ tournamentId, franchiseId }).session(session);
      if (existing) {
        throw new AppError('Franchise already registered for this tournament', 409);
      }

      const teamCount = await TournamentTeam.countDocuments({ tournamentId }).session(session);
      if (teamCount >= tournament.maxTeams) {
        throw new AppError('Maximum team limit reached for this tournament', 400);
      }

      const purse = tournament.defaultPurse;

      const [team] = await TournamentTeam.create([{
        tournamentId,
        franchiseId,
        ownerId,
        name: franchise.name,
        status: REGISTRATION_STATUS.PENDING,
        wallet: {
          initialBudget: purse,
          spentBudget: 0,
          remainingBudget: purse,
          reservedBudget: 0,
        },
        roster: [],
      }], { session });

      // Increment team count atomically within the transaction
      await RegistrationService.incrementTeamsCount(tournamentId, session);

      await session.commitTransaction();
      return team;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async approveTeam(tournamentId, teamId, organizer) {
    const tournament = await TournamentService.getById(tournamentId);
    TournamentService.assertOrganizerAccess(tournament, organizer);

    const team = assertFound(
      await TournamentTeam.findOne({ _id: teamId, tournamentId }),
      'Team not found'
    );

    team.status = REGISTRATION_STATUS.APPROVED;
    team.approvedAt = new Date();
    await team.save();

    // Count was already incremented at registration time.
    // No additional increment here — prevents double-counting.

    await NotificationService.create({
      userId: team.ownerId,
      type: NOTIFICATION_TYPES.TEAM_UPDATE,
      title: 'Team approved',
      message: `${team.name} has been approved for ${tournament.name}`,
      data: { tournamentId, teamId: team._id },
    });

    return team;
  }

  static async rejectTeam(tournamentId, teamId, organizer, reason) {
    const tournament = await TournamentService.getById(tournamentId);
    TournamentService.assertOrganizerAccess(tournament, organizer);

    const team = assertFound(
      await TournamentTeam.findOne({ _id: teamId, tournamentId }),
      'Team not found'
    );

    team.status = REGISTRATION_STATUS.REJECTED;
    team.rejectedReason = reason;
    await team.save();

    // Decrement on every rejection (count was incremented at registration)
    await RegistrationService.decrementTeamsCount(tournamentId);

    return team;
  }

  static async listTeams(tournamentId, query = {}, currentUserId) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { tournamentId };

    if (query.status) filter.status = query.status;
    if (query.ownerId) {
      filter.ownerId = this.resolveUserId(query.ownerId, currentUserId);
    }

    const [teams, total] = await Promise.all([
      TournamentTeam.find(filter)
        .populate({ path: 'franchiseId', select: 'name  logo brandColor shortCode city' })
        .populate({ path: 'ownerId', select: 'fullName name email' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TournamentTeam.countDocuments(filter),
    ]);

    // Map to the exact shape the frontend expects
    const data = teams.map((team) => ({
      id: team._id.toString(),
      teamId: team._id.toString(),
      tournamentId: team.tournamentId?.toString?.() ?? team.tournamentId,
      franchiseId: team.franchiseId?._id?.toString?.() ?? team.franchiseId,
      name: team.name ?? team.franchiseId?.name ?? 'Unnamed Team',
      status: team.status,
      brandColor: team.franchiseId?.brandColor ?? '#6366f1',
      shortCode: team.franchiseId?.shortCode ?? team.name?.slice(0, 2).toUpperCase() ?? 'NA',
      ownerId: team.ownerId?._id?.toString?.() ?? team.ownerId,
      ownerName: team.ownerId?.fullName ?? team.ownerId?.name ?? 'Unknown Owner',
      logo: team.franchiseId?.logo ?? null,
      ownerEmail: team.ownerId?.email ?? null,
      city: team.franchiseId?.city ?? null,
      purse: team.wallet?.initialBudget ?? 0,
      wallet: team.wallet,
      roster: team.roster ?? [],
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    }));

    return buildPaginatedResponse({ data, total, page, limit });
  }

  static async exportSquads(tournamentId) {
    const tournament = await TournamentService.getById(tournamentId);
    const teams = await TournamentTeam.find({ tournamentId, status: REGISTRATION_STATUS.APPROVED })
      .populate({
        path: 'roster.tournamentPlayerId',
        populate: { path: 'playerId' },
      })
      .populate('franchiseId');

    return {
      tournament: {
        id: tournament._id,
        name: tournament.name,
        status: tournament.status,
      },
      teams: teams.map((team) => ({
        id: team._id,
        name: team.name,
        franchise: team.franchiseId,
        wallet: team.wallet,
        squad: team.roster.map((entry) => ({
          tournamentPlayerId: entry.tournamentPlayerId?._id,
          player: entry.tournamentPlayerId?.playerId,
          role: entry.role,
          boughtPrice: entry.boughtPrice,
          boughtAt: entry.boughtAt,
        })),
      })),
    };
  }
    // ====================== APPROVED PLAYERS (AUCTION POOL) ======================

  /**
   * Returns only APPROVED registrations for a tournament.
   * Contract is identical to listPlayers() so the frontend table component
   * can swap the endpoint without changing its renderer.
   *
   * @param {string} tournamentId
   * @param {object} query   — pagination + optional filters (isSold, lotOutcome, userId, search)
   * @param {string} [currentUserId] — for 'me' resolution
   */
  static async listApprovedPlayers(tournamentId, query = {}, currentUserId) {
    const { page, limit, skip } = parsePagination(query);

    // ── Core filter: tournament + APPROVED (immutable for this endpoint) ──
    const filter = {
      tournamentId,
      status: REGISTRATION_STATUS.APPROVED,
    };

    // ── Optional passthrough filters (same as listPlayers) ──
    if (query.isSold !== undefined) filter.isSold = query.isSold === 'true';
    if (query.lotOutcome) filter.lotOutcome = query.lotOutcome;
    if (query.userId) {
      filter.userId = this.resolveUserId(query.userId, currentUserId);
    }

    // ── Search by player name (bonus, non-breaking) ──
    // Because we .populate('playerId'), a regex directly on TournamentPlayer
    // won't hit the player's name. We do a two-step lookup only when search
    // is provided, keeping the hot path (no search) as a single indexed query.
    const search = query.search?.toString().trim();
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(safeSearch, 'i');

      const matchingPlayers = await Player
        .find({ fullName: searchRegex })
        .select('_id')
        .lean();

      const playerIds = matchingPlayers.map((p) => p._id);
      if (playerIds.length === 0) {
        // Early exit: no players match the search → empty paginated response
        return buildPaginatedResponse({ data: [], total: 0, page, limit });
      }
      filter.playerId = { $in: playerIds };
    }

    // ── Execution ──
    const [registrations, total] = await Promise.all([
      TournamentPlayer.find(filter)
        .populate({
          path: 'playerId',
          select: 'fullName primaryRole profileImage',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TournamentPlayer.countDocuments(filter),
    ]);

    // ── Mapper: IDENTICAL shape to listPlayers() ──
    const data = registrations.map((registration) => ({
      id: registration._id.toString(),
      registrationId: registration._id.toString(),
      playerId: registration.playerId?._id?.toString(),
      name: registration.playerId?.fullName ?? '',
      role: registration.primaryRole,
      basePrice: registration.basePrice,
      basePriceUpdatedAt: registration.basePriceUpdatedAt ?? null,
      status: registration.status,
      lotOutcome: registration.lotOutcome,
      isSold: registration.isSold,
      soldPrice: registration.soldPrice,
      profileImage: registration.playerId?.profileImage ?? null,
      createdAt: registration.createdAt,
    }));

    return buildPaginatedResponse({ data, total, page, limit });
  }
}