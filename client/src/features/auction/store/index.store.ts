import { create } from "zustand";
import { AuctionEngine } from "@/features/auction/engine/AuctionEngine";
import type { LiveAuctionSnapshot } from "@/features/auction/types/index.types";

let engineInstance: AuctionEngine | null = null;
let engineUnsubscribe: (() => void) | null = null;

function subscribeEngine(
  engine: AuctionEngine,
  set: (state: Partial<LiveAuctionState>) => void,
) {
  engineUnsubscribe?.();

  engineUnsubscribe = engine.subscribe((snapshot) => {
    set(snapshot);
  });
}

export function getAuctionEngine() {
  if (!engineInstance) {
    engineInstance = new AuctionEngine();
  }
  return engineInstance;
}

export function resetAuctionEngine() {
  engineUnsubscribe?.();
  engineUnsubscribe = null;

  if (engineInstance) {
    engineInstance.destroy();
    engineInstance = null;
  }
}

interface LiveAuctionState extends LiveAuctionSnapshot {
  _subscribed: boolean;
  _initialized: boolean;
  auctionId: string | null;
  tournamentId: string | null;
  bootstrap: (auctionId: string, tournamentId: string) => void;
  setTournamentContext: (tournamentId: string) => void;
  release: (auctionId: string) => void;
  actions: {
    start: () => Promise<{ success: boolean; error?: string }>;
    pause: () => Promise<{ success: boolean; error?: string }>;
    resume: () => Promise<{ success: boolean; error?: string }>;
    complete: () => Promise<{ success: boolean; error?: string }>;
    openNextLot: (playerId?: string) => Promise<{ success: boolean; error?: string }>;
    undo: (actionId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
    placeBid: (teamId: string, amount?: number, isUser?: boolean) => Promise<{ ok: boolean; reason?: string }>;
    forceSold: () => Promise<{ success: boolean; error?: string }>;
    forceUnsold: () => Promise<{ success: boolean; error?: string }>;
    // NEW: aligns with AuctionService.markPermanentUnsold and liveAuctionApi
    markPermanentUnsold: (tournamentPlayerId: string) => Promise<{ success: boolean; error?: string }>;
  };
}

const emptySnapshot: LiveAuctionSnapshot = {
  auction: {} as any,
  rounds: [],
  players: [],
  franchises: [],
  status: "draft",
  currentRoundId: null,
  currentPlayerId: null,
  currentBid: { amount: 0, teamId: null },
  timer: { remaining: 0, total: 0, isRunning: false },
  bidHistory: [],
  logs: [],
  soldEvent: null,
  unsoldEvent: null,
  // NEW: keep state shape aligned with engine snapshot
  permanentUnsoldEvent: null,
  connection: "offline",
  serverLatencyMs: 0,
  playersSoldCount: 0,
  playersUnsoldCount: 0,
  playersPermanentUnsoldCount: 0,
  totalMoneySpent: 0,
  viewerCount: 0,
  undoAction: null,
  undoVersion: 0,
};

export const useLiveAuctionStore = create<LiveAuctionState>((set, get) => ({
  ...emptySnapshot,
  _subscribed: false,
  _initialized: false,
  auctionId: null,
  tournamentId: null,

  bootstrap: (auctionId, tournamentId) => {
    const engine = getAuctionEngine();
    const state = get();

    const sameAuction =
      engine.getAuctionId() === auctionId;

    const engineIsLiveForThisAuction = sameAuction && state._initialized;

    if (
      state._initialized &&
      state.auctionId === auctionId &&
      engineIsLiveForThisAuction
    ) {
      if (!state._subscribed) {
        set({ _subscribed: true });
        subscribeEngine(engine, set);
      }

      return;
    }

    set({
      auctionId,
      tournamentId,
      _initialized: true,
      _subscribed: true,
    });

    subscribeEngine(engine, set);

    void engine.connect(auctionId, tournamentId);
  },

  release: (auctionId) => {
    if (get().auctionId !== auctionId) return;
    resetAuctionEngine();
    set({ ...emptySnapshot, _subscribed: false, _initialized: false, auctionId: null, tournamentId: null });
  },

  setTournamentContext: (tournamentId) => {
    const current = get();
    if (current.tournamentId === tournamentId) return;

    if (current._initialized) {
      resetAuctionEngine();
      set({ ...emptySnapshot, _subscribed: false, _initialized: false, auctionId: null });
    }

    set({ tournamentId });
  },

  actions: {
    start: () => getAuctionEngine().start(),
    pause: () => getAuctionEngine().pause(),
    resume: () => getAuctionEngine().resume(),
    complete: () => getAuctionEngine().complete(),
    openNextLot: (playerId) => getAuctionEngine().openNextLot(playerId),
    undo: (actionId, reason) => getAuctionEngine().undo(actionId, reason),
    placeBid: (teamId, amount, isUser) => getAuctionEngine().placeBid(teamId, amount, isUser),
    forceSold: () => getAuctionEngine().forceSold(),
    forceUnsold: () => getAuctionEngine().forceUnsold(),
    // NEW: delegate to the engine's permanent-unsold command
    markPermanentUnsold: (tournamentPlayerId: string) =>
      getAuctionEngine().markPermanentUnsold(tournamentPlayerId),
  },
}));

export type AuctionRole = "organizer" | "team" | "admin";

interface RoleState {
  role: AuctionRole;
  userTeamId: string;
  setRole: (role: AuctionRole) => void;
  setUserTeamId: (id: string) => void;
}

export const useRoleStore = create<RoleState>((set) => ({
  role: "team",
  userTeamId: "team_user",
  setRole: (role) => set({ role }),
  setUserTeamId: (userTeamId) => set({ userTeamId }),
}));

interface BidUiState {
  isPlacing: boolean;
  lastError: string | null;
  flashSeq: number;
  setPlacing: (v: boolean) => void;
  setError: (msg: string | null) => void;
  flash: () => void;
}

export const useBidUiStore = create<BidUiState>((set) => ({
  isPlacing: false,
  lastError: null,
  flashSeq: 0,
  setPlacing: (v) => set({ isPlacing: v }),
  setError: (msg) => set({ lastError: msg }),
  flash: () => set((s) => ({ flashSeq: s.flashSeq + 1 })),
}));