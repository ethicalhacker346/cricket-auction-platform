import type { AdminOverview, MetricMap, RecentActivity } from '@/types/adminDashboard';

function safeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function safeMetricMap(value: unknown): MetricMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, count]) => [key, safeNumber(count)]),
  );
}

function safeActivity(value: unknown): RecentActivity[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is RecentActivity => Boolean(item && typeof item === 'object' && 'id' in item)).map((item) => {
    const record = item as unknown as Record<string, unknown>;
    const actor = record.actor && typeof record.actor === 'object' ? record.actor as Record<string, unknown> : null;
    return {
      id: String(record.id),
      auctionId: record.auctionId == null ? null : String(record.auctionId),
      tournamentId: record.tournamentId == null ? null : String(record.tournamentId),
      tournamentName: record.tournamentName == null ? null : String(record.tournamentName),
      action: record.action == null ? 'UNKNOWN' : String(record.action),
      message: record.message == null ? null : String(record.message),
      metadata: record.metadata && typeof record.metadata === 'object' ? record.metadata as Record<string, unknown> : null,
      timestamp: typeof record.timestamp === 'string' || record.timestamp instanceof Date ? record.timestamp : null,
      actor: actor && actor.id != null ? { id: String(actor.id), name: actor.name == null ? null : String(actor.name) } : null,
    };
  });
}

/**
 * Normalizes the admin endpoint at the API boundary. The UI can then safely
 * render partial/legacy responses without turning a missing optional field
 * into a blank dashboard or a runtime exception.
 */
export function normalizeAdminOverview(input: unknown): AdminOverview {
  const root = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const platform = root.platform && typeof root.platform === 'object' ? root.platform as Record<string, unknown> : {};
  const tournaments = root.tournaments && typeof root.tournaments === 'object' ? root.tournaments as Record<string, unknown> : {};
  const auctions = root.auctions && typeof root.auctions === 'object' ? root.auctions as Record<string, unknown> : {};
  const activity = root.activity && typeof root.activity === 'object' ? root.activity as Record<string, unknown> : {};
  const attention = root.attention && typeof root.attention === 'object' ? root.attention as Record<string, unknown> : {};
  const dataQuality = root.dataQuality && typeof root.dataQuality === 'object' ? root.dataQuality as Record<string, unknown> : {};
  const meta = root.meta && typeof root.meta === 'object' ? root.meta as Record<string, unknown> : {};

  return {
    platform: {
      users: safeNumber(platform.users),
      activeUsers: safeNumber(platform.activeUsers),
      players: safeNumber(platform.players),
      franchises: safeNumber(platform.franchises),
      organizers: safeNumber(platform.organizers),
      tournaments: safeNumber(platform.tournaments),
    },
    tournaments: {
      total: safeNumber(tournaments.total),
      byStatus: safeMetricMap(tournaments.byStatus),
    },
    auctions: {
      total: safeNumber(auctions.total),
      byStatus: safeMetricMap(auctions.byStatus),
    },
    activity: {
      totalBids: safeNumber(activity.totalBids),
      bidByStatus: safeMetricMap(activity.bidByStatus),
      soldPlayers: safeNumber(activity.soldPlayers),
      unsoldPlayers: safeNumber(activity.unsoldPlayers),
      totalSoldValue: safeNumber(activity.totalSoldValue),
      activeAuctionViewers: safeNumber(activity.activeAuctionViewers),
      playersByLotOutcome: safeMetricMap(activity.playersByLotOutcome),
    },
    attention: {
      pendingPlayerRegistrations: safeNumber(attention.pendingPlayerRegistrations),
      pendingTeamRegistrations: safeNumber(attention.pendingTeamRegistrations),
      unresolvedAuctionPlayers: safeNumber(attention.unresolvedAuctionPlayers),
      liveAuctions: safeNumber(attention.liveAuctions),
    },
    recentActivity: safeActivity(root.recentActivity),
    meta: {
      generatedAt: typeof meta.generatedAt === 'string' || meta.generatedAt instanceof Date ? meta.generatedAt : undefined,
      recentActivityLimit: meta.recentActivityLimit == null ? undefined : safeNumber(meta.recentActivityLimit),
    },
    dataQuality: {
      soldStateMismatches: safeNumber(dataQuality.soldStateMismatches),
    },
  };
}
