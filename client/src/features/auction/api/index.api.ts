import { useAuthStore } from "@/store/authStore";
import type {
  Auction,
  AuctionRound,
  Bid,
  Franchise,
  Player,
  BidIncrementTier,
} from "@/features/auction/types/index.types";
import { API_BASE_URL } from "@/features/auction/constants/index.constants";

// ---------------------------------------------------------------------------
// HTTP client with automatic Bearer injection from authStore
// ---------------------------------------------------------------------------
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const url = `${API_BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({
    success: false,
    message: res.statusText || `HTTP ${res.status}`,
  }));

  if (!res.ok) {
    throw new Error(data.message || `Request failed: ${res.status}`);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Mappers: backend Mongoose shape → frontend types
// (now exported so AuctionEngine.ts can reuse them for Socket.IO payloads)
// ---------------------------------------------------------------------------
export function mapPlayer(tp: any): Player {
  return {
    id: tp._id?.toString?.() || tp.id,
    name: tp.playerId?.name || tp.name,
    role: tp.primaryRole || tp.role,
    country: tp.playerId?.country || tp.country,
    overseas: tp.playerId?.overseas ?? tp.overseas,
    age: tp.playerId?.age ?? tp.age,
    basePrice: tp.basePrice,
    soldPrice: tp.soldPrice,
    teamId: tp.soldToTeamId?.toString?.() || tp.soldToTeamId || tp.teamId,
    status: mapLotOutcome(tp.lotOutcome) || tp.status,
    stats: tp.playerId?.stats || tp.stats,
    tag: tp.tag,
    avatarSeed: tp.avatarSeed || tp.playerId?.name || tp.name,
  };
}

function mapLotOutcome(outcome?: string): Player["status"] {
  switch (outcome) {
    case "NOT_LISTED":
      return "pending";
    case "IN_PROGRESS":
      return "current";
    case "SOLD":
      return "sold";
    case "UNSOLD":
      return "unsold";
    default:
      return "pending";
  }
}

export function mapFranchise(team: any): Franchise {
  const roster: string[] = (team.roster || []).map((r: any) =>
    typeof r === "string" ? r : r.tournamentPlayerId?.toString?.() || r.tournamentPlayerId
  );
  const spent = (team.roster || []).reduce(
    (sum: number, r: any) => sum + (r.boughtPrice || 0),
    0
  );
  return {
    id: team._id?.toString?.() || team.id,
    name: team.name,
    shortName: team.shortName || team.name?.slice(0, 3).toUpperCase(),
    owner: team.ownerId?.name || team.owner || "Unknown",
    colorFrom: team.colorFrom || "#3b82f6",
    colorTo: team.colorTo || "#8b5cf6",
    purseTotal: team.wallet?.initialBudget ?? team.initialBudget ?? team.purseTotal ?? 10000,
    spent: team.wallet?.spentBudget ?? team.spent ?? spent,
    maxSquadSize: team.squadSize || team.maxSquadSize || 25,
    maxOverseas: team.maxOverseas || 8,
    squad: roster,
  };
}

export function mapBid(b: any): Bid {
  return {
    id: b._id?.toString?.() || b.id,
    playerId: b.tournamentPlayerId?.toString?.() || b.tournamentPlayerId || b.playerId,
    teamId: b.tournamentTeamId?._id?.toString?.() || b.tournamentTeamId?.toString?.() || b.tournamentTeamId || b.teamId,
    amount: b.amount,
    timestamp: new Date(b.placedAt || b.timestamp).getTime(),
    roundId: b.roundId?.toString?.() || b.roundId,
    isUser: b.isUser ?? false,
  };
}

export function mapAuction(a: any): Auction {
  const tiers: BidIncrementTier[] = a.bidIncrementTiers?.length
    ? a.bidIncrementTiers
    : [{ upTo: null, increment: a.tournamentId?.minBidIncrement ?? 5 }];

  return {
    id: a._id?.toString?.() || a.id,
    name: a.name || "Auction",
    tournamentName: a.tournamentId?.name || a.tournamentName || "Tournament",
    organizer: a.tournamentId?.organizer?.name || a.organizer || "Organizer",
    status: a.status?.toLowerCase?.() || a.status,
    scheduledAt: a.scheduledAt,
    season: a.season || new Date().getFullYear().toString(),
    rules: {
      bidIncrements: tiers,
      lotTimerSeconds: a.lotTimerSeconds || 30,
      bidResetSeconds: a.bidResetSeconds ?? 12,
      pursePerTeam: a.tournamentId?.defaultPurse || a.pursePerTeam || 10000,
      maxSquadSize: a.tournamentId?.squadSize || a.maxSquadSize || 25,
      maxOverseas: a.maxOverseas || 8,
    },
    createdAt: a.createdAt,
    tournamentId: a.tournamentId?._id?.toString?.() || a.tournamentId,
  };
}

export function mapRound(r: any): AuctionRound {
  return {
    id: r._id?.toString?.() || r.id,
    auctionId: r.auctionId?.toString?.() || r.auctionId,
    name: r.name,
    type: r.type || "normal",
    order: r.order,
    status: r.status?.toLowerCase?.() || r.status,
    playerIds: (r.playerIds || []).map((p: any) => p.toString?.() || p),
  };
}

export function mapLog(l: any): import("@/features/auction/types/index.types").AuctionLog {
  return {
    id: l._id || `${Date.now()}_${Math.random()}`,
    type: (l.action || l.type)?.toLowerCase(),
    message: l.message,
    timestamp: new Date(l.timestamp || l.createdAt).getTime(),
  };
}

// ---------------------------------------------------------------------------
// Wire payload for create/update — deliberately NOT `Partial<Auction>`.
// ---------------------------------------------------------------------------
export interface AuctionSavePayload {
  name?: string;
  scheduledAt?: string;
  lotTimerSeconds?: number;
  bidResetSeconds?: number;
  bidIncrementTiers?: BidIncrementTier[];
}

function toBackendPayload(payload: AuctionSavePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.scheduledAt !== undefined) body.scheduledAt = payload.scheduledAt;
  if (payload.lotTimerSeconds !== undefined) body.lotTimerSeconds = payload.lotTimerSeconds;
  if (payload.bidResetSeconds !== undefined) body.bidResetSeconds = payload.bidResetSeconds;
  if (payload.bidIncrementTiers !== undefined) body.bidIncrementTiers = payload.bidIncrementTiers;
  return body;
}

// ---------------------------------------------------------------------------
// auctionApi
// ---------------------------------------------------------------------------
export const auctionApi = {
  getAuction: async (tournamentId: string) => {
    const res = await request<any>(`/tournaments/${tournamentId}/auction`);
    if (!res.data) return null;
    return mapAuction(res.data);
  },

  getById: async (auctionId: string) => {
    const res = await request<any>(`/auctions/${auctionId}`);
    return mapAuction(res.data ?? res);
  },

  createAuction: async (tournamentId: string, payload: AuctionSavePayload) => {
    const res = await request<any>(`/tournaments/${tournamentId}/auction`, {
      method: "POST",
      body: JSON.stringify(toBackendPayload(payload)),
    });
    return mapAuction(res.data ?? res);
  },

  updateRules: async (auctionId: string, payload: AuctionSavePayload) => {
    const res = await request<any>(`/auctions/${auctionId}`, {
      method: "PATCH",
      body: JSON.stringify(toBackendPayload(payload)),
    });
    return mapAuction(res.data ?? res);
  },

  startAuction: async (auctionId: string) => {
    const res = await request<any>(`/auctions/${auctionId}/start`, { method: "POST" });
    return mapAuction(res.data ?? res);
  },

  pauseAuction: async (auctionId: string) => {
    const res = await request<any>(`/auctions/${auctionId}/pause`, { method: "POST" });
    return mapAuction(res.data ?? res);
  },

  resumeAuction: async (auctionId: string) => {
    const res = await request<any>(`/auctions/${auctionId}/resume`, { method: "POST" });
    return mapAuction(res.data ?? res);
  },

  completeAuction: async (auctionId: string) => {
    const res = await request<any>(`/auctions/${auctionId}/complete`, { method: "POST" });
    return mapAuction(res.data ?? res);
  },

  getLiveState: async (auctionId: string) => {
    const res = await request<any>(`/auctions/${auctionId}/live`);
    return res.data ?? res;
  },

  getSnapshot: async (auctionId: string): Promise<import("@/features/auction/types").AuctionSnapshot> => {
    const res = await request<any>(`/auctions/${auctionId}/snapshot`);
    const d = res.data ?? res;
    return {
      auction: mapAuction(d.auction),
      rounds: (d.rounds || []).map(mapRound),
      players: (d.players || []).map(mapPlayer),
      franchises: (d.franchises || []).map(mapFranchise),
      bidHistory: (d.bidHistory || []).map(mapBid),
      logs: (d.logs || []).map(mapLog),
      status: d.status?.toLowerCase?.() || d.status,
      currentRoundId: d.currentRoundId?.toString?.() || d.currentRoundId || null,
      currentPlayerId: d.currentPlayerId?.toString?.() || d.currentPlayerId || null,
      currentBid: {
        amount: d.currentBid?.amount ?? 0,
        teamId: d.currentBid?.teamId?.toString?.() || d.currentBid?.teamId || null,
      },
      timer: d.timer,
      lotStatus: d.lotStatus,
      version: d.version ?? 0,
      generatedAt: d.generatedAt,
      viewerCount: d.viewerCount ?? 0,
    };
  },

  heartbeatViewer: async (auctionId: string, viewerId: string) => {
    const res = await request<any>(`/auctions/${auctionId}/viewers/heartbeat`, {
      method: "POST",
      body: JSON.stringify({ viewerId }),
    });
    return (res.data ?? res) as { viewerCount: number };
  },

  leaveViewer: async (auctionId: string, viewerId: string) => {
    const res = await request<any>(`/auctions/${auctionId}/viewers/leave`, {
      method: "POST",
      body: JSON.stringify({ viewerId }),
    });
    return (res.data ?? res) as { viewerCount: number };
  },

  getViewerCount: async (auctionId: string) => {
    const res = await request<any>(`/auctions/${auctionId}/viewers/count`);
    return (res.data ?? res) as { viewerCount: number };
  },
};

// ---------------------------------------------------------------------------
// auctionRoundApi
// ---------------------------------------------------------------------------
export const auctionRoundApi = {
  listRounds: async (auctionId: string) => {
    const res = await request<any[]>(`/auctions/${auctionId}/rounds`);
    return (res.data ?? res).map(mapRound);
  },

  addRound: async (auctionId: string, round: Omit<AuctionRound, "id" | "auctionId">) => {
    const res = await request<any>(`/auctions/${auctionId}/rounds`, {
      method: "POST",
      body: JSON.stringify(round),
    });
    return mapRound(res.data ?? res);
  },

  updateRound: async (auctionId: string, id: string, patch: Partial<AuctionRound>) => {
    const res = await request<any>(`/auctions/${auctionId}/rounds/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return mapRound(res.data ?? res);
  },

  deleteRound: async (auctionId: string, id: string) => {
    await request<any>(`/auctions/${auctionId}/rounds/${id}`, { method: "DELETE" });
    return { success: true };
  },
};

// ---------------------------------------------------------------------------
// playerApi
// ---------------------------------------------------------------------------
export const playerApi = {
  listPlayers: async (tournamentId: string) => {
    const res = await request<any[]>(`/tournaments/${tournamentId}/players`);
    return (res.data ?? res).map(mapPlayer);
  },

  getPlayersByRound: async (roundId: string) => {
    const res = await request<any[]>(`/auction-rounds/${roundId}/players`);
    return (res.data ?? res).map(mapPlayer);
  },

  updatePlayer: async (id: string, patch: Partial<Player>) => {
    const res = await request<any>(`/players/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return mapPlayer(res.data ?? res);
  },
};

// ---------------------------------------------------------------------------
// franchiseApi
// ---------------------------------------------------------------------------
export const franchiseApi = {
  listFranchises: async (tournamentId: string) => {
    const res = await request<any[]>(`/tournaments/${tournamentId}/teams`);
    return (res.data ?? res).map(mapFranchise);
  },

  updateFranchise: async (id: string, patch: Partial<Franchise>) => {
    const res = await request<any>(`/teams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return mapFranchise(res.data ?? res);
  },
};

// ---------------------------------------------------------------------------
// liveAuctionApi
// ---------------------------------------------------------------------------
export const liveAuctionApi = {
  getLiveState: async (auctionId: string) => auctionApi.getLiveState(auctionId),

  openLot: async (auctionId: string, playerId: string, roundId: string) => {
    const res = await request<any>(`/auctions/${auctionId}/lot/open`, {
      method: "POST",
      body: JSON.stringify({ tournamentPlayerId: playerId, roundId }),
    });
    return res.data ?? res;
  },

  markSold: async (auctionId: string, _playerId: string, _teamId: string, _amount: number) => {
    const res = await request<any>(`/auctions/${auctionId}/lot/sold`, { method: "POST" });
    return res.data ?? res;
  },

  markUnsold: async (auctionId: string, _playerId: string) => {
    const res = await request<any>(`/auctions/${auctionId}/lot/unsold`, { method: "POST" });
    return res.data ?? res;
  },
};

// ---------------------------------------------------------------------------
// bidApi
// ---------------------------------------------------------------------------
export const bidApi = {
  placeBid: async (auctionId: string, bid: { amount?: number; playerId?: string; teamId?: string }) => {
    const res = await request<any>(`/auctions/${auctionId}/bids`, {
      method: "POST",
      body: JSON.stringify({ amount: bid.amount }),
    });
    return mapBid(res.data ?? res);
  },

  listBids: async (auctionId: string, playerId?: string) => {
    const query = playerId ? `?tournamentPlayerId=${playerId}` : "";
    const res = await request<any[]>(`/auctions/${auctionId}/bids${query}`);
    return (res.data ?? res).map(mapBid);
  },
};

// ---------------------------------------------------------------------------
// Seed snapshot builder (now async against real backend)
// ---------------------------------------------------------------------------
export async function getSeedSnapshot(tournamentId: string, auctionId?: string) {
  const [auction, rounds, players, franchises] = await Promise.all([
    auctionId ? auctionApi.getById(auctionId) : auctionApi.getAuction(tournamentId),
    auctionId ? auctionRoundApi.listRounds(auctionId) : Promise.resolve([]),
    playerApi.listPlayers(tournamentId),
    franchiseApi.listFranchises(tournamentId),
  ]);

  return { auction, rounds, players, franchises };
}