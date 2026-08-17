import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Player } from '../models/Player.js';
import { Franchise } from '../models/Franchise.js';
import { Tournament } from '../models/Tournament.js';
import { TournamentPlayer } from '../models/TournamentPlayer.js';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { AuctionViewer, VIEWER_HEARTBEAT_TTL_SECONDS } from '../models/AuctionViewer.js';
import { REGISTRATION_STATUS, LOT_OUTCOME, AUCTION_STATUS, USER_ROLES } from '../config/constants.js';
import { buildPaginatedResponse, parsePagination } from '../utils/helpers.js';

const MAX_LIMIT = 100;
const UNRESOLVED_LOT_OUTCOMES = [LOT_OUTCOME.NOT_LISTED, LOT_OUTCOME.IN_PROGRESS, LOT_OUTCOME.UNSOLD];
const ALLOWED_USER_ROLES = new Set(Object.values(USER_ROLES));
const ALLOWED_AUCTION_STATUSES = new Set(Object.values(AUCTION_STATUS));
const SORT_DIRECTIONS = new Set(['asc', 'desc', '1', '-1']);

function pagination(query = {}) {
  const parsed = parsePagination(query);
  return {
    page: parsed.page,
    limit: Math.min(parsed.limit, MAX_LIMIT),
    skip: parsed.skip,
  };
}

function safeRegex(value) {
  const text = value?.toString().trim();
  if (!text) return null;
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function safeSort(query, fallback = { createdAt: -1 }) {
  const allowed = new Set(['createdAt', 'updatedAt', 'name', 'email', 'status', 'lastLoginAt', 'scheduledAt', 'startedAt', 'completedAt']);
  const field = allowed.has(query.sortBy) ? query.sortBy : Object.keys(fallback)[0];
  const direction = SORT_DIRECTIONS.has(String(query.sortOrder))
    ? (String(query.sortOrder) === 'asc' || String(query.sortOrder) === '1' ? 1 : -1)
    : fallback[field] ?? -1;
  return { [field]: direction };
}

function booleanQuery(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

function normalizeFilterStatus(value, allowed) {
  if (!value) return undefined;
  return allowed.has(value) ? value : null;
}

function pageResponse({ data, total, page, limit }) {
  return buildPaginatedResponse({ data, total, page, limit });
}

export class AdminResourceService {
  static async listUsers(query = {}) {
    const { page, limit, skip } = pagination(query);
    const filter = {};
    const role = normalizeFilterStatus(query.role, ALLOWED_USER_ROLES);
    if (role === null) return pageResponse({ data: [], total: 0, page, limit });
    if (role) filter.role = role;
    const isActive = booleanQuery(query.isActive);
    if (isActive !== undefined) filter.isActive = isActive;
    const search = safeRegex(query.search);
    if (search) filter.$or = [{ name: search }, { email: search }];

    const [rows, total] = await Promise.all([
      User.find(filter)
        .select('name email role isActive lastLoginAt createdAt updatedAt')
        .sort(safeSort(query))
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return pageResponse({
      data: rows.map((row) => ({ ...row, id: row._id.toString(), _id: undefined })),
      total,
      page,
      limit,
    });
  }

  static async listTournaments(query = {}) {
    const { page, limit, skip } = pagination(query);
    const filter = {};
    const status = query.status?.toString().trim();
    if (status) filter.status = status;
    const search = safeRegex(query.search);
    if (search) filter.$or = [{ name: search }, { slug: search }, { season: search }];
    if (query.organizerId) filter.organizerId = query.organizerId;

    const [rows, total] = await Promise.all([
      Tournament.find(filter)
        .select('name slug season status organizerId playerRegistrationOpen teamRegistrationOpen registrationDeadline auctionDate playersCount teamsCount maxTeams squadSize createdAt updatedAt')
        .populate('organizerId', 'name email')
        .sort(safeSort(query))
        .skip(skip)
        .limit(limit)
        .lean(),
      Tournament.countDocuments(filter),
    ]);

    return pageResponse({
      data: rows.map((row) => ({
        ...row,
        id: row._id.toString(),
        organizer: row.organizerId ? { id: row.organizerId._id.toString(), name: row.organizerId.name, email: row.organizerId.email } : null,
        organizerId: row.organizerId?._id?.toString?.() ?? row.organizerId ?? null,
        _id: undefined,
      })),
      total,
      page,
      limit,
    });
  }

  static async listPlayers(query = {}) {
    const { page, limit, skip } = pagination(query);
    const filter = {};
    const search = safeRegex(query.search);
    if (search) filter.$or = [{ fullName: search }, { nationality: search }];
    if (query.primaryRole) filter.primaryRole = query.primaryRole;
    const isActive = booleanQuery(query.isActive);
    if (isActive !== undefined) filter.isActive = isActive;

    const [rows, total] = await Promise.all([
      Player.find(filter)
        .select('userId fullName dateOfBirth nationality primaryRole battingStyle bowlingStyle profileImage isActive createdAt updatedAt')
        .populate('userId', 'name email role isActive')
        .sort(safeSort(query))
        .skip(skip)
        .limit(limit)
        .lean(),
      Player.countDocuments(filter),
    ]);

    return pageResponse({
      data: rows.map((row) => ({
        ...row,
        id: row._id.toString(),
        user: row.userId ? { id: row.userId._id.toString(), name: row.userId.name, email: row.userId.email, role: row.userId.role, isActive: row.userId.isActive } : null,
        userId: row.userId?._id?.toString?.() ?? row.userId ?? null,
        _id: undefined,
      })),
      total,
      page,
      limit,
    });
  }

  static async listFranchises(query = {}) {
    const { page, limit, skip } = pagination(query);
    const filter = {};
    const search = safeRegex(query.search);
    if (search) filter.$or = [{ name: search }, { slug: search }, { city: search }];
    const isActive = booleanQuery(query.isActive);
    if (isActive !== undefined) filter.isActive = isActive;
    if (query.ownerId) filter.ownerId = query.ownerId;

    const [rows, total] = await Promise.all([
      Franchise.find(filter)
        .select('ownerId name slug logo city description isActive createdAt updatedAt')
        .populate('ownerId', 'name email role')
        .sort(safeSort(query))
        .skip(skip)
        .limit(limit)
        .lean(),
      Franchise.countDocuments(filter),
    ]);

    return pageResponse({
      data: rows.map((row) => ({
        ...row,
        id: row._id.toString(),
        owner: row.ownerId ? { id: row.ownerId._id.toString(), name: row.ownerId.name, email: row.ownerId.email, role: row.ownerId.role } : null,
        ownerId: row.ownerId?._id?.toString?.() ?? row.ownerId ?? null,
        _id: undefined,
      })),
      total,
      page,
      limit,
    });
  }

  static async listAuctions(query = {}) {
    const { page, limit, skip } = pagination(query);
    const status = normalizeFilterStatus(query.status, ALLOWED_AUCTION_STATUSES);
    if (status === null) return pageResponse({ data: [], total: 0, page, limit });
    const search = safeRegex(query.search);
    const preMatch = {};
    if (status) preMatch.status = status;
    if (query.tournamentId) preMatch.tournamentId = query.tournamentId;

    const cutoff = new Date(Date.now() - VIEWER_HEARTBEAT_TTL_SECONDS * 1000);
    const pipeline = [];
    if (Object.keys(preMatch).length) pipeline.push({ $match: preMatch });
    pipeline.push(
      {
        $lookup: {
          from: Tournament.collection.name,
          localField: 'tournamentId',
          foreignField: '_id',
          as: 'tournament',
        },
      },
      { $unwind: { path: '$tournament', preserveNullAndEmptyArrays: false } },
    );
    if (search) {
      pipeline.push({ $match: { $or: [{ name: search }, { 'tournament.name': search }, { 'tournament.slug': search }] } });
    }
    pipeline.push(
      {
        $facet: {
          data: [
            { $sort: safeSort(query, { scheduledAt: -1 }) },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: Bid.collection.name,
                let: { auctionId: '$_id' },
                pipeline: [{ $match: { $expr: { $eq: ['$auctionId', '$$auctionId'] } } }, { $count: 'value' }],
                as: 'bidStats',
              },
            },
            {
              $lookup: {
                from: AuctionViewer.collection.name,
                let: { auctionId: '$_id' },
                pipeline: [
                  { $match: { $expr: { $and: [{ $eq: ['$auctionId', '$$auctionId'] }, { $gte: ['$lastSeenAt', cutoff] }] } } },
                  { $count: 'value' },
                ],
                as: 'viewerStats',
              },
            },
            {
              $lookup: {
                from: TournamentPlayer.collection.name,
                let: { tournamentId: '$tournamentId' },
                pipeline: [
                  { $match: { $expr: { $and: [{ $eq: ['$tournamentId', '$$tournamentId'] }, { $eq: ['$status', REGISTRATION_STATUS.APPROVED] }, { $in: ['$lotOutcome', UNRESOLVED_LOT_OUTCOMES] }] } } },
                  { $count: 'value' },
                ],
                as: 'unresolvedStats',
              },
            },
            {
              $project: {
                _id: 0,
                id: { $toString: '$_id' },
                name: { $ifNull: ['$name', '$tournament.name'] },
                status: 1,
                scheduledAt: 1,
                startedAt: 1,
                completedAt: 1,
                createdAt: 1,
                updatedAt: 1,
                liveState: { lotStatus: '$liveState.lotStatus', currentHighestBid: '$liveState.currentHighestBid', currentTournamentPlayerId: '$liveState.currentTournamentPlayerId' },
                tournament: { id: { $toString: '$tournament._id' }, name: '$tournament.name', status: '$tournament.status', slug: '$tournament.slug' },
                bidCount: { $ifNull: [{ $arrayElemAt: ['$bidStats.value', 0] }, 0] },
                activeViewerCount: { $ifNull: [{ $arrayElemAt: ['$viewerStats.value', 0] }, 0] },
                unresolvedPlayerCount: { $ifNull: [{ $arrayElemAt: ['$unresolvedStats.value', 0] }, 0] },
              },
            },
          ],
          total: [{ $count: 'value' }],
        },
      },
    );

    const [result] = await Auction.aggregate(pipeline).allowDiskUse(true).exec();
    return pageResponse({ data: result?.data ?? [], total: result?.total?.[0]?.value ?? 0, page, limit });
  }

  static async listAuditLogs(query = {}) {
    const { page, limit, skip } = pagination(query);
    const match = {};
    const action = query.action?.toString().trim();
    if (action) match['logs.action'] = action;
    if (query.auctionId) match._id = new mongoose.Types.ObjectId(query.auctionId);
    if (query.tournamentId) match.tournamentId = new mongoose.Types.ObjectId(query.tournamentId);
    const search = safeRegex(query.search);
    const cutoff = query.from ? new Date(query.from) : null;
    const until = query.to ? new Date(query.to) : null;

    const pipeline = [{ $match: match }, { $unwind: '$logs' }];
    const logMatch = {};
    if (action) logMatch['logs.action'] = action;
    if (cutoff && !Number.isNaN(cutoff.getTime())) logMatch['logs.timestamp'] = { ...(logMatch['logs.timestamp'] || {}), $gte: cutoff };
    if (until && !Number.isNaN(until.getTime())) logMatch['logs.timestamp'] = { ...(logMatch['logs.timestamp'] || {}), $lte: until };
    if (search) logMatch.$or = [{ 'logs.message': search }, { 'logs.action': search }];
    if (Object.keys(logMatch).length) pipeline.push({ $match: logMatch });
    pipeline.push(
      {
        $facet: {
          data: [
            { $sort: { 'logs.timestamp': -1 } },
            { $skip: skip },
            { $limit: limit },
            { $lookup: { from: Tournament.collection.name, localField: 'tournamentId', foreignField: '_id', as: 'tournament' } },
            { $unwind: { path: '$tournament', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: User.collection.name, localField: 'logs.userId', foreignField: '_id', as: 'actor' } },
            { $unwind: { path: '$actor', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                id: { $concat: [{ $toString: '$_id' }, ':', { $toString: '$logs.timestamp' }, ':', '$logs.action'] },
                auctionId: { $toString: '$_id' },
                tournamentId: { $toString: '$tournamentId' },
                tournamentName: '$tournament.name',
                action: '$logs.action',
                message: '$logs.message',
                metadata: '$logs.metadata',
                timestamp: '$logs.timestamp',
                actor: { id: { $toString: '$actor._id' }, name: '$actor.name' },
              },
            },
          ],
          total: [{ $count: 'value' }],
        },
      },
    );

    const [result] = await Auction.aggregate(pipeline).allowDiskUse(true).exec();
    return pageResponse({ data: result?.data ?? [], total: result?.total?.[0]?.value ?? 0, page, limit });
  }

  static async getSystemHealth() {
    const startedAt = Date.now();
    const readyState = mongoose.connection.readyState;
    const stateLabels = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    let databaseStatus = stateLabels[readyState] ?? 'unknown';
    let pingMs = null;
    if (readyState === 1 && mongoose.connection.db) {
      try {
        const pingStartedAt = Date.now();
        await mongoose.connection.db.admin().ping();
        pingMs = Date.now() - pingStartedAt;
        databaseStatus = 'healthy';
      } catch {
        databaseStatus = 'degraded';
      }
    }

    const status = databaseStatus === 'healthy' ? 'healthy' : 'degraded';
    return {
      status,
      generatedAt: new Date(),
      requestDurationMs: Date.now() - startedAt,
      api: { status: 'healthy' },
      database: { status: databaseStatus, readyState, pingMs },
      process: { uptimeSeconds: Math.round(process.uptime()), nodeVersion: process.version, memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024) },
    };
  }
}
