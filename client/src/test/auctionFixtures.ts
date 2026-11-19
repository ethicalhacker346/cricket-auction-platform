import type { Auction, AuctionSnapshot, Franchise, Player } from "@/features/auction/types/index.types";

export const auction = {
  id: "auction-a",
  tournamentId: "tournament-a",
  name: "Test Auction",
  tournamentName: "Test League",
  organizer: "organizer-a",
  status: "live",
  scheduledAt: "2026-11-18T10:00:00.000Z",
  season: "2026",
  createdAt: "2026-11-18T09:00:00.000Z",
  rules: {
    bidIncrements: [{ upTo: null, increment: 1000 }],
    lotTimerSeconds: 30,
    bidResetSeconds: 12,
    pursePerTeam: 10_000_000,
    maxSquadSize: 15,
    maxOverseas: 4,
  },
} satisfies Auction;

export function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-a",
    name: "Asha Rao",
    role: "Batter",
    country: "India",
    overseas: false,
    age: 24,
    basePrice: 100_000,
    status: "current",
    stats: { matches: 12, runs: 440, wickets: 0, average: 40, strikeRate: 140 },
    avatarSeed: "asha",
    ...overrides,
  };
}

export const franchise: Franchise = {
  id: "team-a",
  name: "Coastal Strikers",
  shortName: "CS",
  owner: "Owner",
  ownerId: "owner-a",
  franchiseId: "franchise-a",
  colorFrom: "#34d399",
  colorTo: "#059669",
  purseTotal: 10_000_000,
  spent: 0,
  reservedBudget: 0,
  maxSquadSize: 15,
  maxOverseas: 4,
  squad: [],
};

export function makeSnapshot(overrides: Partial<AuctionSnapshot> = {}): AuctionSnapshot {
  return {
    auction,
    undoAction: null,
    undoVersion: 0,
    rounds: [],
    players: [makePlayer()],
    franchises: [franchise],
    bidHistory: [],
    logs: [],
    status: "live",
    currentRoundId: null,
    currentPlayerId: "player-a",
    currentBid: { amount: 0, teamId: null },
    timer: { remaining: 30, total: 30, isRunning: true },
    lotStatus: "BIDDING",
    version: 1,
    generatedAt: "2026-11-18T10:01:00.000Z",
    viewerCount: 1,
    ...overrides,
  };
}
