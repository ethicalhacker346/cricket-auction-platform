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

    const [data, total] = await Promise.all([
      Tournament.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Tournament.countDocuments(filter),
    ]);

    return buildPaginatedResponse({ data, total, page, limit });
  }

  static async getById(id) {
    return assertFound(await Tournament.findById(id), 'Tournament not found');
  }

  static async update(id, user, payload) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    if (payload.name) {
      payload.slug = slugify(payload.name);
    }

    Object.assign(tournament, payload);
    await tournament.save();
    return tournament;
  }

  static async openPlayerRegistration(id, user) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    tournament.playerRegistrationOpen = true;
    tournament.status = TOURNAMENT_STATUS.REGISTRATION_OPEN;
    await tournament.save();
    return tournament;
  }

  static async openTeamRegistration(id, user) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    tournament.teamRegistrationOpen = true;
    await tournament.save();
    return tournament;
  }

  static async markTeamsApproved(id, user) {
    const tournament = await TournamentService.getById(id);
    TournamentService.assertOrganizerAccess(tournament, user);

    tournament.status = TOURNAMENT_STATUS.TEAMS_APPROVED;
    await tournament.save();
    return tournament;
  }

  static assertOrganizerAccess(tournament, user) {
    const isOrganizer = tournament.organizerId.toString() === user._id.toString();
    const isAdmin = user.role === USER_ROLES.ADMIN;

    if (!isOrganizer && !isAdmin) {
      throw new AppError('Only the tournament organizer can perform this action', 403);
    }
  }
}
