export type MetricMap = Record<string, number>;

export interface RecentActivity {
  id: string;
  auctionId: string | null;
  tournamentId: string | null;
  tournamentName: string | null;
  action: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string | Date | null;
  actor: { id: string; name: string | null } | null;
}

export interface AdminOverview {
  platform: {
    users: number;
    activeUsers: number;
    players: number;
    franchises: number;
    organizers: number;
    tournaments: number;
  };
  tournaments: {
    total: number;
    byStatus: MetricMap;
  };
  auctions: {
    total: number;
    byStatus: MetricMap;
  };
  activity: {
    totalBids: number;
    bidByStatus?: MetricMap;
    soldPlayers: number;
    unsoldPlayers: number;
    totalSoldValue: number;
    activeAuctionViewers: number;
    playersByLotOutcome?: MetricMap;
  };
  attention: {
    pendingPlayerRegistrations: number;
    pendingTeamRegistrations: number;
    unresolvedAuctionPlayers: number;
    liveAuctions: number;
  };
  recentActivity: RecentActivity[];
  meta?: {
    generatedAt?: string | Date;
    recentActivityLimit?: number;
  };
  dataQuality?: {
    soldStateMismatches?: number;
  };
}
