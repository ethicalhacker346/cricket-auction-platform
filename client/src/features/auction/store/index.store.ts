import { create } from "zustand";
import { AuctionEngine } from "@/features/auction/engine/AuctionEngine";
import type { LiveAuctionSnapshot } from "@/features/auction/types/index.types";

// ============================================================================
// Singleton engine — lazily created so we can inject real IDs at bootstrap
// ============================================================================
let engineInstance: AuctionEngine | null = null;

export function getAuctionEngine() {
  if (!engineInstance) {
    engineInstance = new AuctionEngine();
  }
  return engineInstance;
}

export function resetAuctionEngine() {
  if (engineInstance) {
    engineInstance.destroy();
    engineInstance = null;
  }
}

// ---------------------------------------------------------------------------
// liveAuctionStore
// ---------------------------------------------------------------------------
interface LiveAuctionState extends LiveAuctionSnapshot {
  _subscribed: boolean;
  _initialized: boolean;
  auctionId: string | null;
  tournamentId: string | null;
  bootstrap: (auctionId: string, tournamentId: string) => void;
  /** Record tournament context without requiring an auctionId — for screens
   * reached before an auction exists yet (e.g. "Create Auction"). See
   * store implementation for why this can't just reuse bootstrap(). */
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
  connection: "offline",
  serverLatencyMs: 0,
  playersSoldCount: 0,
  playersUnsoldCount: 0,
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

    // BUG FIX: this used to trust the store's own `_initialized`/`auctionId`
    // flags alone. If something elsewhere in the app called
    // resetAuctionEngine() (e.g. on sign-out, or a hard error boundary),
    // `getAuctionEngine()` above hands back a brand-new, never-connected
    // instance — but the store's flags still said "already initialized for
    // this auctionId" from before the reset. That took the early-return
    // resubscribe branch below, called engine.subscribe() on a dead engine
    // that had no data and wasn't polling, and the screen sat empty with no
    // error and no retry. Checking the engine's own connected auctionId
    // instead of the store's memory of it makes this self-healing: a reset
    // engine simply looks unconnected and falls through to a real connect().
    const engineIsLiveForThisAuction = engine.getAuctionId() === auctionId && engine.isConnected();

    if (get()._initialized && get().auctionId === auctionId && engineIsLiveForThisAuction) {
      if (!get()._subscribed) {
        set({ _subscribed: true });
        engine.subscribe((snapshot) => set(snapshot));
      }
      return;
    }

    set({ auctionId, tournamentId, _initialized: true, _subscribed: true });
    engine.connect(auctionId, tournamentId);
    engine.subscribe((snapshot) => set(snapshot));
  },

  // BUG FIX (root cause of "No Tournament Selected" showing after clicking
  // "Create Auction"): bootstrap() above only ever sets `tournamentId` as a
  // side effect of connecting the live engine, which requires an auctionId.
  // AuctionModule's goTo() correctly never calls bootstrap() when there's no
  // auction yet — but that meant the store's tournamentId was simply never
  // set on the way to /auctions/create, even though the button click knows
  // exactly which tournament it's for. This gives navigation a way to record
  // that context without pretending there's a live auction to poll.
  setTournamentContext: (tournamentId) => {
    const current = get();
    if (current.tournamentId === tournamentId) return;

    // Switching context away from whatever the live engine (if any) was
    // bootstrapped for — e.g. going straight from a live auction in
    // tournament A to "create auction" for tournament B. Tear down the
    // stale connection rather than leaving it polling for A while the rest
    // of the UI now reflects B.
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
  },
}));

// ---------------------------------------------------------------------------
// roleStore — derives from auth, but allows override for dev/testing
// ---------------------------------------------------------------------------
export type AuctionRole = "organizer" | "team" | "admin";

interface RoleState {
  role: AuctionRole;
  userTeamId: string;
  setRole: (role: AuctionRole) => void;
  setUserTeamId: (id: string) => void; // ← NEW
}

export const useRoleStore = create<RoleState>((set) => ({
  role: "team",
  userTeamId: "team_user", // TODO: replace with real user team mapping from auth/profile
  setRole: (role) => set({ role }),
  setUserTeamId: (userTeamId) => set({ userTeamId }), // ← NEW
}));

// ---------------------------------------------------------------------------
// bidStore — ephemeral UI state
// ---------------------------------------------------------------------------
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