import { User } from '../models/User.js';
import { Player } from '../models/Player.js';
import { Franchise } from '../models/Franchise.js';
import { Tournament } from '../models/Tournament.js';
import { TournamentPlayer } from '../models/TournamentPlayer.js';
import { TournamentTeam } from '../models/TournamentTeam.js';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { AuctionViewer, VIEWER_HEARTBEAT_TTL_SECONDS } from '../models/AuctionViewer.js';
import {
  USER_ROLES,
  TOURNAMENT_STATUS,
  AUCTION_STATUS,
  REGISTRATION_STATUS,
  LOT_OUTCOME,
  BID_STATUS,
} from '../config/constants.js';

const RECENT_ACTIVITY_DEFAULT_LIMIT = 12;
const RECENT_ACTIVITY_MAX_LIMIT = 50;

const TOURNAMENT_STATUS_KEYS = Object.values(TOURNAMENT_STATUS);
const AUCTION_STATUS_KEYS = Object.values(AUCTION_STATUS);
const REGISTRATION_STATUS_KEYS = Object.values(REGISTRATION_STATUS);
const LOT_OUTCOME_KEYS = Object.values(LOT_OUTCOME);

const UNRESOLVED_LOT_OUTCOMES = [
  LOT_OUTCOME.NOT_LISTED,
  LOT_OUTCOME.IN_PROGRESS,
  LOT_OUTCOME.UNSOLD,
];

// A paused auction is still an active auction room. Its viewers should remain
// visible to an administrator even though bidding is temporarily disabled.
const VIEWER_COUNT_AUCTION_STATUSES = [
  AUCTION_STATUS.LIVE,
  AUCTION_STATUS.PAUSED,
];

const numberOrZero = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const firstFacet = (facetResult) => facetResult?.[0] ?? {};

const facetCount = (facetResult, key) => numberOrZero(firstFacet(facetResult)[key]?.[0]?.value);

const facetSum = (facetResult, key) => numberOrZero(firstFacet(facetResult)[key]?.[0]?.value);

const directCount = (aggregateResult) => numberOrZero(aggregateResult?.[0]?.value);

/**
 * Converts grouped aggregation rows into a stable DTO map.
 *
 * Known enum values always exist in the result, including when their count is
 * zero. Unknown/missing values are surfaced under UNKNOWN instead of silently
 * disappearing; this is useful for detecting legacy/corrupt records in an
 * admin dashboard. UNKNOWN is omitted when its count is zero to keep the
 * normal response compact.
 */
function distribution(rows = [], knownKeys = []) {
  const result = Object.fromEntries(knownKeys.map((key) => [key, 0]));
  let unknown = 0;

  for (const row of rows) {
    const key = row?._id;
    const count = numberOrZero(row?.value ?? row?.count);
    if (key != null && Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] += count;
    } else {
      unknown += count;
    }
  }

  if (unknown > 0) result.UNKNOWN = unknown;
  return result;
}

function toId(value) {
  return value == null ? null : String(value);
}

function clampActivityLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return RECENT_ACTIVITY_DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), RECENT_ACTIVITY_MAX_LIMIT);
}

async function executeAggregate(model, pipeline, { allowDiskUse = false } = {}) {
  const aggregate = model.aggregate(pipeline);
  if (allowDiskUse) aggregate.allowDiskUse(true);
  return aggregate.exec();
}

function buildUserPipeline() {
  return [
    {
      $facet: {
        total: [{ $count: 'value' }],
        active: [{ $match: { isActive: true } }, { $count: 'value' }],
        byRole: [{ $group: { _id: '$role', value: { $sum: 1 } } }],
      },
    },
  ];
}

function buildSimpleProfilePipeline() {
  return [
    {
      $facet: {
        total: [{ $count: 'value' }],
        active: [{ $match: { isActive: true } }, { $count: 'value' }],
      },
    },
  ];
}

function buildStatusPipeline() {
  return [
    {
      $facet: {
        total: [{ $count: 'value' }],
        byStatus: [{ $group: { _id: '$status', value: { $sum: 1 } } }],
      },
    },
  ];
}

function buildTournamentPlayerPipeline() {
  return [
    {
      $facet: {
        total: [{ $count: 'value' }],
        byRegistrationStatus: [
          { $group: { _id: '$status', value: { $sum: 1 } } },
        ],
        byLotOutcome: [
          { $group: { _id: '$lotOutcome', value: { $sum: 1 } } },
        ],
        sold: [
          { $match: { isSold: true } },
          { $count: 'value' },
        ],
        soldValue: [
          { $match: { isSold: true, soldPrice: { $type: 'number' } } },
          { $group: { _id: null, value: { $sum: '$soldPrice' } } },
        ],
        unsold: [
          { $match: { lotOutcome: { $in: [LOT_OUTCOME.UNSOLD, LOT_OUTCOME.PERMANENT_UNSOLD] } } },
          { $count: 'value' },
        ],
        unresolved: [
          {
            $match: {
              status: REGISTRATION_STATUS.APPROVED,
              lotOutcome: { $in: UNRESOLVED_LOT_OUTCOMES },
            },
          },
          { $count: 'value' },
        ],
        soldStateMismatches: [
          {
            $match: {
              $or: [
                { isSold: true, lotOutcome: { $ne: LOT_OUTCOME.SOLD } },
                { lotOutcome: LOT_OUTCOME.SOLD, isSold: { $ne: true } },
              ],
            },
          },
          { $count: 'value' },
        ],
      },
    },
  ];
}

function buildViewerPipeline(cutoff) {
  return [
    { $match: { lastSeenAt: { $gte: cutoff } } },
    {
      $lookup: {
        from: Auction.collection.name,
        localField: 'auctionId',
        foreignField: '_id',
        as: 'auction',
      },
    },
    { $unwind: '$auction' },
    { $match: { 'auction.status': { $in: VIEWER_COUNT_AUCTION_STATUSES } } },
    { $count: 'value' },
  ];
}

function buildRecentActivityPipeline(limit) {
  return [
    { $match: { logs: { $exists: true, $ne: [] } } },
    { $unwind: '$logs' },
    { $sort: { 'logs.timestamp': -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: Tournament.collection.name,
        localField: 'tournamentId',
        foreignField: '_id',
        as: 'tournament',
      },
    },
    { $unwind: { path: '$tournament', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'logs.userId',
        foreignField: '_id',
        as: 'actor',
      },
    },
    { $unwind: { path: '$actor', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        auctionId: '$_id',
        tournamentId: 1,
        tournamentName: '$tournament.name',
        action: '$logs.action',
        message: '$logs.message',
        metadata: '$logs.metadata',
        timestamp: '$logs.timestamp',
        actorId: '$actor._id',
        actorName: '$actor.name',
      },
    },
  ];
}

function mapRecentActivity(rows) {
  return rows.map((row) => {
    const timestamp = row.timestamp ? new Date(row.timestamp) : null;
    const auctionId = toId(row.auctionId);
    const action = row.action ?? 'UNKNOWN';

    return {
      // Auction log subdocuments intentionally have _id: false. This stable
      // composite id is sufficient for a read-only dashboard list.
      id: `${auctionId ?? 'unknown'}:${timestamp?.getTime() ?? 'unknown'}:${action}`,
      auctionId,
      tournamentId: toId(row.tournamentId),
      tournamentName: row.tournamentName ?? null,
      action,
      message: row.message ?? null,
      metadata: row.metadata ?? null,
      timestamp,
      actor: row.actorId
        ? { id: toId(row.actorId), name: row.actorName ?? null }
        : null,
    };
  });
}

export class AdminDashboardService {
  /**
   * Read-only platform overview.
   *
   * This method deliberately bypasses domain command services. It performs
   * bounded MongoDB aggregations and returns a normalized dashboard DTO.
   */
  static async getOverview({ recentActivityLimit } = {}) {
    const activityLimit = clampActivityLimit(recentActivityLimit);
    const cutoff = new Date(Date.now() - VIEWER_HEARTBEAT_TTL_SECONDS * 1000);

    const [
      userResult,
      playerResult,
      franchiseResult,
      tournamentResult,
      auctionResult,
      tournamentPlayerResult,
      tournamentTeamResult,
      bidResult,
      viewerResult,
      recentActivityResult,
    ] = await Promise.all([
      executeAggregate(User, buildUserPipeline()),
      executeAggregate(Player, buildSimpleProfilePipeline()),
      executeAggregate(Franchise, buildSimpleProfilePipeline()),
      executeAggregate(Tournament, buildStatusPipeline()),
      executeAggregate(Auction, buildStatusPipeline()),
      executeAggregate(TournamentPlayer, buildTournamentPlayerPipeline(), { allowDiskUse: true }),
      executeAggregate(TournamentTeam, buildStatusPipeline()),
      executeAggregate(Bid, buildStatusPipeline(), { allowDiskUse: true }),
      executeAggregate(AuctionViewer, buildViewerPipeline(cutoff)),
      executeAggregate(Auction, buildRecentActivityPipeline(activityLimit), { allowDiskUse: true }),
    ]);

    const userFacet = firstFacet(userResult);
    const playerFacet = firstFacet(playerResult);
    const franchiseFacet = firstFacet(franchiseResult);
    const tournamentFacet = firstFacet(tournamentResult);
    const auctionFacet = firstFacet(auctionResult);
    const tournamentPlayerFacet = firstFacet(tournamentPlayerResult);
    const tournamentTeamFacet = firstFacet(tournamentTeamResult);
    const bidFacet = firstFacet(bidResult);

    const userByRole = distribution(userFacet.byRole, Object.values(USER_ROLES));
    const tournamentByStatus = distribution(tournamentFacet.byStatus, TOURNAMENT_STATUS_KEYS);
    const auctionByStatus = distribution(auctionFacet.byStatus, AUCTION_STATUS_KEYS);
    const playerRegistrationByStatus = distribution(
      tournamentPlayerFacet.byRegistrationStatus,
      REGISTRATION_STATUS_KEYS,
    );
    const teamRegistrationByStatus = distribution(
      tournamentTeamFacet.byStatus,
      REGISTRATION_STATUS_KEYS,
    );
    const playersByLotOutcome = distribution(
      tournamentPlayerFacet.byLotOutcome,
      LOT_OUTCOME_KEYS,
    );
    const bidByStatus = distribution(bidFacet.byStatus, Object.values(BID_STATUS));

    return {
      platform: {
        users: facetCount(userResult, 'total'),
        activeUsers: facetCount(userResult, 'active'),
        players: facetCount(playerResult, 'total'),
        franchises: facetCount(franchiseResult, 'total'),
        organizers: userByRole[USER_ROLES.ORGANIZER] ?? 0,
        tournaments: facetCount(tournamentResult, 'total'),
      },
      tournaments: {
        total: facetCount(tournamentResult, 'total'),
        byStatus: tournamentByStatus,
      },
      auctions: {
        total: facetCount(auctionResult, 'total'),
        byStatus: auctionByStatus,
      },
      activity: {
        totalBids: facetCount(bidResult, 'total'),
        bidByStatus,
        soldPlayers: facetCount(tournamentPlayerResult, 'sold'),
        unsoldPlayers: facetCount(tournamentPlayerResult, 'unsold'),
        totalSoldValue: facetSum(tournamentPlayerResult, 'soldValue'),
        activeAuctionViewers: directCount(viewerResult),
        playersByLotOutcome,
      },
      attention: {
        pendingPlayerRegistrations: playerRegistrationByStatus[REGISTRATION_STATUS.PENDING] ?? 0,
        pendingTeamRegistrations: teamRegistrationByStatus[REGISTRATION_STATUS.PENDING] ?? 0,
        unresolvedAuctionPlayers: facetCount(tournamentPlayerResult, 'unresolved'),
        liveAuctions: auctionByStatus[AUCTION_STATUS.LIVE] ?? 0,
      },
      recentActivity: mapRecentActivity(recentActivityResult),
      meta: {
        generatedAt: new Date(),
        recentActivityLimit: activityLimit,
        definitions: {
          activeUsers: 'User.isActive === true; this is account availability, not online presence',
          activeAuctionViewers: 'lastSeenAt is within the viewer heartbeat TTL on LIVE or PAUSED auctions',
          unresolvedAuctionPlayers: 'APPROVED registrations with NOT_LISTED, IN_PROGRESS, or UNSOLD lot outcome',
          soldPlayers: 'TournamentPlayer.isSold === true',
          unsoldPlayers: 'lotOutcome is UNSOLD or PERMANENT_UNSOLD',
        },
      },
      dataQuality: {
        soldStateMismatches: facetCount(tournamentPlayerResult, 'soldStateMismatches'),
      },
    };
  }
}

export const __adminDashboardInternals = Object.freeze({
  buildUserPipeline,
  buildSimpleProfilePipeline,
  buildStatusPipeline,
  buildTournamentPlayerPipeline,
  buildViewerPipeline,
  buildRecentActivityPipeline,
  distribution,
  clampActivityLimit,
  directCount,
});
