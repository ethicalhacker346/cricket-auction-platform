import { Tournament } from '../models/Tournament.js';
import { TournamentPlayer } from '../models/TournamentPlayer.js';
import { TournamentTeam } from '../models/TournamentTeam.js';
import { Player } from '../models/Player.js';
import { Franchise } from '../models/Franchise.js';
import { AppError, assertFound, parsePagination, buildPaginatedResponse } from '../utils/helpers.js';
import { REGISTRATION_STATUS, TOURNAMENT_STATUS } from '../config/constants.js';
import { TournamentService } from './tournament.service.js';
import { FranchiseService } from './franchise.service.js';
import { NotificationService } from './notification.service.js';

export class RegistrationService {
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
    });

    await NotificationService.create({
      userId: tournament.organizerId,
      type: 'registration',
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

    registration.status = REGISTRATION_STATUS.VERIFIED;
    registration.verifiedAt = new Date();
    await registration.save();

    await NotificationService.create({
      userId: registration.userId,
      type: 'registration',
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

    return registration;
  }

  static async listPlayers(tournamentId, query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { tournamentId };

    if (query.status) filter.status = query.status;
    if (query.isSold !== undefined) filter.isSold = query.isSold === 'true';

    const [data, total] = await Promise.all([
      TournamentPlayer.find(filter)
        .populate('playerId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TournamentPlayer.countDocuments(filter),
    ]);

    return buildPaginatedResponse({ data, total, page, limit });
  }

  static async registerTeam(tournamentId, ownerId, { franchiseId }) {
    const tournament = await TournamentService.getById(tournamentId);

    if (!tournament.teamRegistrationOpen) {
      throw new AppError('Team registration is closed for this tournament', 400);
    }

    const franchise = await FranchiseService.getById(franchiseId);
    await FranchiseService.assertOwner(franchise, ownerId);

    const existing = await TournamentTeam.findOne({ tournamentId, franchiseId });
    if (existing) {
      throw new AppError('Franchise already registered for this tournament', 409);
    }

    const teamCount = await TournamentTeam.countDocuments({ tournamentId });
    if (teamCount >= tournament.maxTeams) {
      throw new AppError('Maximum team limit reached for this tournament', 400);
    }

    const purse = tournament.defaultPurse;

    return TournamentTeam.create({
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
    });
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

    return team;
  }

  static async listTeams(tournamentId, query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { tournamentId };

    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
      TournamentTeam.find(filter)
        .populate('franchiseId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TournamentTeam.countDocuments(filter),
    ]);

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
}
