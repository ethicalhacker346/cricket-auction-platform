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
  actions: {
    start: () => void;
    pause: () => void;
    resume: () => void;
    complete: () => void;
    openNextLot: () => void;
    placeBid: (teamId: string, amount?: number, isUser?: boolean) => Promise<{ ok: boolean; reason?: string }>;
    forceSold: () => void;
    forceUnsold: () => void;
    // NEW: aligns with AuctionService.markPermanentUnsold and liveAuctionApi
    markPermanentUnsold: (tournamentPlayerId: string) => void;
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

  /*
   * Terminal auctions are intentionally offline.
   * Never reconnect them, even if bootstrap() is called again
   * by AuctionShell or a child route.
   */
    if (sameAuction && engine.isTerminal()) {
      if (!state._subscribed) {
        set({
          auctionId,
          tournamentId,
          _initialized: true,
          _subscribed: true,
        });

        subscribeEngine(engine, set);
      }

      return;
    }

    const engineIsLiveForThisAuction =
      sameAuction && engine.isConnected();

    if (
      state._initialized &&
      state.auctionId === auctionId &&
      engineIsLiveForThisAuction
    ) {
      if (!state._subscribed) {
        set({ _subscribed: true });
        engine.subscribe((snapshot) => set(snapshot));
      }

      return;
    }

    set({
      auctionId,
      tournamentId,
      _initialized: true,
      _subscribed: true,
    });

    engine.subscribe((snapshot) => set(snapshot));

    void engine.connect(auctionId, tournamentId);
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
    openNextLot: () => getAuctionEngine().openNextLot(),
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