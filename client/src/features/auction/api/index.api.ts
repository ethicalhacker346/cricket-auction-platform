import { useAuthStore } from "@/store/authStore";
import type {
  Auction, AuctionPermissions, AuctionRound, Bid, Franchise, Player,
  BidIncrementTier, AuctionSnapshot, PlayerRole,
} from "@/features/auction/types/index.types";
import { normalizeAuctionPermissions } from "@/features/auction/utils/index.utils";
import { API_BASE_URL } from "@/features/auction/constants/index.constants";

export class AuctionApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message); this.name = "AuctionApiError"; this.status = status; this.code = code; this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data: any = await res.json().catch(() => ({ success: false, message: res.statusText || `HTTP ${res.status}` }));
  if (!res.ok) throw new AuctionApiError(data.message || `Request failed: ${res.status}`, res.status, data.code, data.details);
  return data as T;
}

const stringId = (value: any): string => value?.toString?.() || value || "";

/* ============================================================================
   ROLE NORMALIZER  ← NEW
   Backend enum: BATSMAN | BOWLER | ALL_ROUNDER | WICKET_KEEPER
   Frontend contract: Batter | Bowler | All-Rounder | Wicket-Keeper
   ============================================================================ */
function normalizePlayerRole(role: string | undefined): PlayerRole {
  if (!role) return "Batter";
  const r = role.toUpperCase().replace(/[\s_-]/g, "");
  if (r === "BATSMAN" || r === "BAT") return "Batter";
  if (r === "BOWLER" || r === "BOWL") return "Bowler";
  if (r === "ALLROUNDER" || r === "ALL_ROUNDER" || r === "AR") return "All-Rounder";
  if (r === "WICKETKEEPER" || r === "WICKET_KEEPER" || r === "WK") return "Wicket-Keeper";
  return role as PlayerRole;
}

export function mapPlayer(tp: any): Player {
  const playerDoc = tp.playerId;
  
  return {
    id: stringId(tp._id || tp.id),
    name: playerDoc?.fullName || tp.fullName || tp.name || "Unknown Player",
    fullName: playerDoc?.fullName || tp.fullName,
    role: normalizePlayerRole(tp.primaryRole || tp.role),   // ← FIX
    country: playerDoc?.nationality || tp.country || "",
    overseas: playerDoc?.overseas ?? tp.overseas ?? false,
    age: playerDoc?.age ?? tp.age ?? computeAge(playerDoc?.dateOfBirth) ?? 0,
    basePrice: tp.basePrice ?? 0,
    soldPrice: tp.soldPrice,
    teamId: stringId(tp.soldToTeamId || tp.teamId) || undefined,
    status: mapLotOutcome(tp.lotOutcome) || tp.status || "pending",
    stats: playerDoc?.stats || tp.stats || { matches: 0, runs: 0, wickets: 0, average: 0, strikeRate: 0 },
    tag: tp.tag,
    avatarSeed: tp.avatarSeed || playerDoc?.fullName || tp.name || stringId(tp._id),
    profileImage: playerDoc?.profileImage || tp.profileImage || undefined,
    battingStyle: playerDoc?.battingStyle || tp.battingStyle || undefined,
    bowlingStyle: playerDoc?.bowlingStyle || tp.bowlingStyle || undefined,
    bio: playerDoc?.bio || tp.bio || undefined,
    category: tp.category || undefined,
    soldAt: tp.soldAt ? new Date(tp.soldAt).toISOString() : undefined,
    soldToTeamName: tp.soldToTeamId?.name || tp.soldToTeamName || undefined,
  };
}

function computeAge(dob?: string | Date): number | undefined {
  if (!dob) return undefined;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age > 0 ? age : undefined;
}

// ------------------------------------------------------------------
// mapLotOutcome — add PERMANENT_UNSOLD mapping
// ------------------------------------------------------------------
function mapLotOutcome(outcome?: string): Player["status"] {
  return ({
    NOT_LISTED: "pending",
    IN_PROGRESS: "current",
    SOLD: "sold",
    UNSOLD: "unsold",
    PERMANENT_UNSOLD: "permanent_unsold",
  } as const)[outcome as any] || "pending";
}


export function mapFranchise(team: any): Franchise {
  const franchiseDoc = team.franchiseId && typeof team.franchiseId === 'object' 
    ? team.franchiseId 
    : null;
  
  const ownerDoc = team.ownerId && typeof team.ownerId === 'object' 
    ? team.ownerId 
    : null;

  const roster = (team.roster || []).map((r: any) =>
    typeof r === "string" ? r : stringId(r.tournamentPlayerId)
  );
  const spent = (team.roster || []).reduce(
    (sum: number, r: any) => sum + (r.boughtPrice || 0),
    0
  );

  const seed = franchiseDoc?.slug || franchiseDoc?.name || team.name || stringId(team._id);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const derivedFrom = `hsl(${hue} 70% 50%)`;
  const derivedTo = `hsl(${(hue + 55) % 360} 70% 40%)`;

  return {
    id: stringId(team._id || team.id),
    name: team.name || franchiseDoc?.name || "",
    shortName:
      team.shortName ||
      franchiseDoc?.shortName ||
      team.name?.slice(0, 3).toUpperCase() ||
      "TEAM",
    owner:
      ownerDoc?.name ||
      franchiseDoc?.ownerId?.name ||
      team.owner ||
      "Unknown",
    ownerId: stringId(team.ownerId?._id || team.ownerId),
    franchiseId: stringId(team.franchiseId?._id || team.franchiseId),
    colorFrom: franchiseDoc?.colorFrom || team.colorFrom || derivedFrom,
    colorTo: franchiseDoc?.colorTo || team.colorTo || derivedTo,
    purseTotal:
      team.wallet?.initialBudget ??
      team.initialBudget ??
      team.purseTotal ??
      10000,
    spent: team.wallet?.spentBudget ?? team.spent ?? spent,
    reservedBudget: team.wallet?.reservedBudget ?? team.reservedBudget ?? 0,
    maxSquadSize: 25,
    maxOverseas: 8,
    squad: roster,
    logo: franchiseDoc?.logo || team.logo || undefined,
    city: franchiseDoc?.city || team.city || undefined,
    description: franchiseDoc?.description || team.description || undefined,
  };
}

export function mapBid(b: any): Bid {
  return {
    id: stringId(b._id || b.id),
    playerId: stringId(b.tournamentPlayerId || b.playerId),
    teamId: stringId(b.tournamentTeamId?._id || b.tournamentTeamId || b.teamId),
    amount: b.amount ?? 0,
    timestamp: new Date(b.placedAt || b.timestamp).getTime(),
    roundId: stringId(b.roundId),
    isUser: b.isUser ?? false,
  };
}

export function mapAuction(a: any): Auction {
  const config = a.auctionConfiguration || {};
  const tiers: BidIncrementTier[] = a.bidIncrementTiers?.length
    ? a.bidIncrementTiers
    : config.bidIncrementTiers?.length
    ? config.bidIncrementTiers
    : [{ upTo: null, increment: a.tournamentId?.minBidIncrement ?? 5 }];
  
  return {
    id: stringId(a._id || a.id),
    name: a.name || "Auction",
    tournamentName: a.tournamentId?.name || a.tournamentName || "Tournament",
    organizer: a.tournamentId?.organizer?.name || a.organizer || "Organizer",
    status: a.status?.toLowerCase?.() || a.status,
    scheduledAt: a.scheduledAt,
    season: a.season || new Date().getFullYear().toString(),
    rules: {
      bidIncrements: tiers,
      lotTimerSeconds: config.lotTimerSeconds ?? a.lotTimerSeconds ?? 30,
      bidResetSeconds: config.bidResetSeconds ?? a.bidResetSeconds ?? 12,
      pursePerTeam: config.pursePerTeam ?? a.tournamentId?.defaultPurse ?? a.pursePerTeam ?? 10000,
      maxSquadSize: config.squadSize ?? a.tournamentId?.squadSize ?? a.maxSquadSize ?? 25,
      maxOverseas: a.maxOverseas || 8,
    },
    createdAt: a.createdAt,
    tournamentId: stringId(a.tournamentId?._id || a.tournamentId) || undefined,
  };
}

export function mapRound(r: any): AuctionRound {
  return {
    id: stringId(r._id || r.id),
    auctionId: stringId(r.auctionId),
    name: r.name,
    type: r.type || "normal",
    category: r.category ?? "CUSTOM",
    order: r.order,
    status: r.status?.toLowerCase?.() || r.status,
    playerIds: (r.playerIds || []).map(stringId),
  };
}

export function mapLog(l: any): import("@/features/auction/types/index.types").AuctionLog {
  return {
    id: stringId(l._id || l.id) || `${Date.now()}_${Math.random()}`,
    type: (l.action || l.type)?.toLowerCase(),
    message: l.message,
    timestamp: new Date(l.timestamp || l.createdAt).getTime(),
  };
}

export interface AuctionSavePayload {
  name?: string;
  scheduledAt?: string;
  lotTimerSeconds?: number;
  bidResetSeconds?: number;
  bidIncrementTiers?: BidIncrementTier[];
}

function toBackendPayload(payload: AuctionSavePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of ["name", "scheduledAt", "lotTimerSeconds", "bidResetSeconds", "bidIncrementTiers"] as const) {
    if (payload[key] !== undefined) body[key] = payload[key];
  }
  return body;
}

const dataOf = (res: any) => res?.data ?? res;

export const auctionApi = {
  getAuction: async (tournamentId: string) => {
    const res = await request<any>(`/tournaments/${tournamentId}/auction`);
    return res.data ? mapAuction(res.data) : null;
  },
  getById: async (auctionId: string) => mapAuction(dataOf(await request<any>(`/auctions/${auctionId}`))),
  getPermissions: async (auctionId: string): Promise<AuctionPermissions> =>
    normalizeAuctionPermissions(dataOf(await request<any>(`/auctions/${auctionId}/permissions`))),
  createAuction: async (tournamentId: string, payload: AuctionSavePayload) =>
    mapAuction(dataOf(await request<any>(`/tournaments/${tournamentId}/auction`, {
      method: "POST",
      body: JSON.stringify(toBackendPayload(payload)),
    }))),
  updateRules: async (auctionId: string, payload: AuctionSavePayload) =>
    mapAuction(dataOf(await request<any>(`/auctions/${auctionId}`, {
      method: "PATCH",
      body: JSON.stringify(toBackendPayload(payload)),
    }))),
  startAuction: async (auctionId: string) =>
    mapAuction(dataOf(await request<any>(`/auctions/${auctionId}/start`, { method: "POST" }))),
  pauseAuction: async (auctionId: string) =>
    mapAuction(dataOf(await request<any>(`/auctions/${auctionId}/pause`, { method: "POST" }))),
  resumeAuction: async (auctionId: string) =>
    mapAuction(dataOf(await request<any>(`/auctions/${auctionId}/resume`, { method: "POST" }))),
  completeAuction: async (auctionId: string) =>
    mapAuction(dataOf(await request<any>(`/auctions/${auctionId}/complete`, { method: "POST" }))),
  getLiveState: async (auctionId: string) => dataOf(await request<any>(`/auctions/${auctionId}/live`)),
  
  getSnapshot: async (auctionId: string): Promise<AuctionSnapshot> => {
    const d = dataOf(await request<any>(`/auctions/${auctionId}/snapshot`));
    const auction = mapAuction(d.auction);
    
    const rawFranchises = (d.franchises || []).map(mapFranchise);
    const franchises = rawFranchises.map((f) => ({
      ...f,
      maxSquadSize: auction.rules.maxSquadSize,
      maxOverseas: auction.rules.maxOverseas,
    }));

    return {
      auction,
      rounds: (d.rounds || []).map(mapRound),
      players: (d.players || []).map(mapPlayer),
      franchises,
      bidHistory: (d.bidHistory || []).map(mapBid),
      logs: (d.logs || []).map(mapLog),
      status: d.status?.toLowerCase?.() || d.status,
      currentRoundId: stringId(d.currentRoundId) || null,
      currentPlayerId: stringId(d.currentPlayerId) || null,
      currentBid: {
        amount: d.currentBid?.amount ?? 0,
        teamId: stringId(d.currentBid?.teamId) || null,
      },
      timer: d.timer,
      lotStatus: d.lotStatus,
      version: d.version ?? 0,
      generatedAt: d.generatedAt,
      viewerCount: d.viewerCount ?? 0,
    };
  },
  
  heartbeatViewer: async (auctionId: string, viewerId: string) =>
    dataOf(await request<any>(`/auctions/${auctionId}/viewers/heartbeat`, {
      method: "POST",
      body: JSON.stringify({ viewerId }),
    })) as { viewerCount: number },
  leaveViewer: async (auctionId: string, viewerId: string) =>
    dataOf(await request<any>(`/auctions/${auctionId}/viewers/leave`, {
      method: "POST",
      body: JSON.stringify({ viewerId }),
    })) as { viewerCount: number },
  getViewerCount: async (auctionId: string) =>
    dataOf(await request<any>(`/auctions/${auctionId}/viewers/count`)) as { viewerCount: number },
};

export const auctionRoundApi = {
  listRounds: async (auctionId: string) =>
    (dataOf(await request<any>(`/auctions/${auctionId}/rounds`)) || []).map(mapRound),
  addRound: async (auctionId: string, round: Omit<AuctionRound, "id" | "auctionId">) =>
    mapRound(dataOf(await request<any>(`/auctions/${auctionId}/rounds`, {
      method: "POST",
      body: JSON.stringify(round),
    }))),
  updateRound: async (auctionId: string, id: string, patch: Partial<AuctionRound>) =>
    mapRound(dataOf(await request<any>(`/auctions/${auctionId}/rounds/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }))),
  deleteRound: async (auctionId: string, id: string) => {
    await request<any>(`/auctions/${auctionId}/rounds/${id}`, { method: "DELETE" });
    return { success: true };
  },
};

export const playerApi = {
  listPlayers: async (tournamentId: string) =>
    (dataOf(await request<any>(`/tournaments/${tournamentId}/players`)) || []).map(mapPlayer),
  getPlayersByRound: async (roundId: string) =>
    (dataOf(await request<any>(`/auction-rounds/${roundId}/players`)) || []).map(mapPlayer),
  updatePlayer: async (id: string, patch: Partial<Player>) =>
    mapPlayer(dataOf(await request<any>(`/players/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }))),
};

export const franchiseApi = {
  listFranchises: async (tournamentId: string) =>
    (dataOf(await request<any>(`/tournaments/${tournamentId}/teams`)) || []).map(mapFranchise),
  updateFranchise: async (id: string, patch: Partial<Franchise>) =>
    mapFranchise(dataOf(await request<any>(`/teams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }))),
};

export const liveAuctionApi = {
  getLiveState: (auctionId: string) => auctionApi.getLiveState(auctionId),
  openLot: async (auctionId: string, playerId: string, roundId: string) =>
    dataOf(await request<any>(`/auctions/${auctionId}/lot/open`, {
      method: "POST",
      body: JSON.stringify({ tournamentPlayerId: playerId, roundId }),
    })),
  markSold: async (auctionId: string, _playerId: string, _teamId: string, _amount: number) =>
    dataOf(await request<any>(`/auctions/${auctionId}/lot/sold`, { method: "POST" })),
  markUnsold: async (auctionId: string, _playerId: string) =>
    dataOf(await request<any>(`/auctions/${auctionId}/lot/unsold`, { method: "POST" })),
  // NEW: organizer explicitly retires a player from the unsold pool
  markPermanentUnsold: async (auctionId: string, tournamentPlayerId: string) =>
    dataOf(await request<any>(`/auctions/${auctionId}/players/${tournamentPlayerId}/permanent-unsold`, {
      method: "POST",
    })),
};

export const bidApi = {
  placeBid: async (auctionId: string, bid: { amount?: number; playerId?: string; teamId?: string }) =>
    mapBid(dataOf(await request<any>(`/auctions/${auctionId}/bids`, {
      method: "POST",
      body: JSON.stringify({ amount: bid.amount }),
    }))),
  listBids: async (auctionId: string, playerId?: string) =>
    (dataOf(await request<any>(
      `/auctions/${auctionId}/bids${playerId ? `?tournamentPlayerId=${encodeURIComponent(playerId)}` : ""}`
    )) || []).map(mapBid),
};

export async function getSeedSnapshot(tournamentId: string, auctionId?: string) {
  const [auction, rounds, players, franchises] = await Promise.all([
    auctionId ? auctionApi.getById(auctionId) : auctionApi.getAuction(tournamentId),
    auctionId ? auctionRoundApi.listRounds(auctionId) : Promise.resolve([]),
    playerApi.listPlayers(tournamentId),
    franchiseApi.listFranchises(tournamentId),
  ]);
  return { auction, rounds, players, franchises };
}