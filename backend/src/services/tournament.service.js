import { Tournament } from '../models/Tournament.js';
import { AppError, assertFound, slugify, parsePagination, buildPaginatedResponse } from '../utils/helpers.js';
import { TOURNAMENT_STATUS, USER_ROLES } from '../config/constants.js';

export class TournamentService {
  static async create(organizerId, payload) {
    const slug = slugify(payload.name);

    const existing = await Tournament.findOne({ slug });
    if (existing) {
      throw new AppError('Tournament with similar name already exists', 409);
    }

    return Tournament.create({
      ...payload,
      slug,
      organizerId,
      status: TOURNAMENT_STATUS.DRAFT,
    });
  }

  static async list(query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};

    if (query.status) filter.status = query.status;
    if (query.organizerId) filter.organizerId = query.organizerId;

    // ─── SEARCH SUPPORT ───
    const search = query.search?.toString().trim();
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: searchRegex },
        { slug: searchRegex },
      ];
      // If your Tournament schema has a `description` or `location` field, add them here:
      // { description: searchRegex },
    }

    const [data, total] = await Promise.all([
      Tournament.find(filter)
        .populate({
          path: "organizerId",
          select: "name",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),   // lean() = plain JS objects, faster for reads
      Tournament.countDocuments(filter),
    ]);

    return buildPaginatedResponse({ data, total, page, limit });
  }

  static async getById(id) {
    return assertFound(await Tournament.findById(id) .populate({ path: "organizerId", select: "name", }), 'Tournament not found');
  }

  // Generic field updates only — status is never accepted here. Status
  // changes must go through transitionTo() so the state machine in
  // config/constants.js (TOURNAMENT_TRANSITIONS) can't be bypassed by a
  // stray `status` key slipping through a PATCH body.
  static async update(id, user, payload) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    console.log(tournament.organizerId);

    const { status: _ignoredStatus, ...safePayload } = payload;

    if (safePayload.name) {
      safePayload.slug = slugify(safePayload.name);
    }

    Object.assign(tournament, safePayload);

    try {
      await tournament.save();
    } catch (err) {
      if (err.name === 'VersionError') {
        throw new AppError('Tournament was updated concurrently, please retry', 409);
      }
      throw err;
    }

    return tournament;
  }

  static async openPlayerRegistration(id, user) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    tournament.playerRegistrationOpen = true;
    await tournament.transitionTo(TOURNAMENT_STATUS.PLAYER_REGISTRATION_OPEN);
    return tournament;
  }

  static async openTeamRegistration(id, user) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    tournament.teamRegistrationOpen = true;
    // transitionTo() validates PLAYER_REGISTRATION_OPEN -> TEAM_REGISTRATION_OPEN;
    // player verification itself is tracked per-TournamentPlayer, so no
    // separate tournament-wide "verification" gate is required here.
    await tournament.transitionTo(TOURNAMENT_STATUS.TEAM_REGISTRATION_OPEN);
    return tournament;
  }

  static async markTeamsApproved(id, user) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    await tournament.transitionTo(TOURNAMENT_STATUS.TEAMS_APPROVED);
    return tournament;
  }

  // New methods for full lifecycle
  static async scheduleAuction(id, user, auctionDate) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    if (auctionDate) {
      tournament.auctionDate = auctionDate;
    }
    await tournament.transitionTo(TOURNAMENT_STATUS.AUCTION_SCHEDULED);
    return tournament;
  }

  static async startAuction(id, user) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    await tournament.transitionTo(TOURNAMENT_STATUS.AUCTION_RUNNING);
    return tournament;
  }

  static async completeAuction(id, user) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    await tournament.transitionTo(TOURNAMENT_STATUS.AUCTION_COMPLETED);
    return tournament;
  }

  static async completeTournament(id, user) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    await tournament.transitionTo(TOURNAMENT_STATUS.TOURNAMENT_COMPLETED);
    return tournament;
  }

  static async cancel(id, user) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    await tournament.transitionTo(TOURNAMENT_STATUS.CANCELLED);
    return tournament;
  }

 static assertOrganizerAccess(tournament, user) {
    const organizerId =
        tournament.organizerId?._id || tournament.organizerId;

    const isOrganizer =
        organizerId.toString() === user._id.toString();

    const isAdmin = user.role === USER_ROLES.ADMIN;

    if (!isOrganizer && !isAdmin) {
        throw new AppError(
            "Only the tournament organizer can perform this action",
            403
        );
    }
  }
}