import type {
  Auction,
  AuctionLog,
  AuctionRound,
  Bid,
  Franchise,
  LiveAuctionSnapshot,
  Player,
} from "../types/index.types";
import { getNextBidAmount } from "@/features/auction/utils/index.utils";
import { uid } from "@/features/auction/utils/index.utils";
import {
  auctionApi,
  bidApi,
  liveAuctionApi,
  mapAuction,
  mapRound,
  mapBid,
  mapPlayer,
} from "@/features/auction/api/index.api";
import { SOCKET_EVENTS, WS_URL } from "@/features/auction/constants/index.constants";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/authStore";

type Listener = (snapshot: LiveAuctionSnapshot) => void;

// Reconciliation interval: full snapshot fetch as a safety net for missed
// socket events or state drift. In Socket.IO mode this is a backup; in
// fallback REST mode this is the primary data source.
const RECONCILE_INTERVAL_MS = 10000;
// Local timer interpolation between server updates (socket or poll).
const TICK_INTERVAL_MS = 250;

export class AuctionEngine {
  private auctionId: string | null = null;
  private tournamentId: string | null = null;
  private listeners = new Set<Listener>();
  private socket: Socket | null = null;
  private intentionalDisconnect = false;

  // Local cache
  private auction: Auction | null = null;
  private rounds: AuctionRound[] = [];
  private players: Player[] = [];
  private franchises: Franchise[] = [];
  private bidHistory: Bid[] = [];
  private logs: AuctionLog[] = [];

  // Live state
  private currentRoundId: string | null = null;
  private currentPlayerId: string | null = null;
  private currentBid = { amount: 0, teamId: null as string | null };
  private timer = { remaining: 0, total: 0, isRunning: false };
  private timerSyncedAt = 0;
  private timerSyncedRemaining = 0;
  private lastVersion = -1;
  private viewerCount = 0;

  private soldEvent: LiveAuctionSnapshot["soldEvent"] = null;
  private unsoldEvent: LiveAuctionSnapshot["unsoldEvent"] = null;
  private eventSeq = 0;
  private connection: LiveAuctionSnapshot["connection"] = "connecting";
  private latency = 40;

  private reconcileHandle: ReturnType<typeof setInterval> | null = null;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor() {}

  getAuctionId() {
    return this.auctionId;
  }

  isConnected() {
    return this.connection === "connected" && this.auctionId !== null;
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------
  async connect(auctionId: string, tournamentId: string) {
    if (this.destroyed) return;

    this.disconnect();

    this.auctionId = auctionId;
    this.tournamentId = tournamentId;
    this.intentionalDisconnect = false;
    this.connection = "connecting";
    this.emit();

    try {
      // 1. Hydrate immediately from REST so the UI isn't blank while the
      //    socket handshake is in flight.
      await this.refreshSnapshot();

      // 2. Attempt Socket.IO; degrade gracefully to REST polling on failure.
      let socketReady = false;
      try {
        await this.setupSocket(auctionId);
        socketReady = true;
      } catch (socketErr: any) {
        this.pushLog("disconnect", `Socket unavailable: ${socketErr.message}`);
      }

      this.connection = "connected";
      this.pushLog(
        "connect",
        socketReady ? "Connected to live auction room" : "Connected via REST fallback"
      );
      this.emit();

      // 3. Reconciliation poll: safety net for missed events / state drift.
      this.reconcileHandle = setInterval(() => this.refreshSnapshot(), RECONCILE_INTERVAL_MS);
      this.tickHandle = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    } catch (err: any) {
      this.connection = "offline";
      this.pushLog("disconnect", `Connection failed: ${err.message}`);
      this.emit();
    }
  }

  private async setupSocket(auctionId: string): Promise<void> {
    const token = useAuthStore.getState().accessToken;

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error("Socket initialization failed"));

      const timeout = setTimeout(() => {
        reject(new Error("Socket connection timeout"));
      }, 10000);

      this.socket.on("connect", () => {
        clearTimeout(timeout);
        this.socket?.emit("join:auction", auctionId);
        resolve();
      });

      this.socket.on("connect_error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.bindSocketEvents();
    });
  }

  private bindSocketEvents() {
    if (!this.socket) return;

    // -----------------------------------------------------------------------
    // Auction lifecycle
    // -----------------------------------------------------------------------
    this.socket.on(SOCKET_EVENTS.AUCTION_STARTED, (payload: any) => {
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      } else if (this.auction) {
        this.auction.status = "live";
      }
      this.pushLog("start", "Auction has started");
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.AUCTION_PAUSED, (payload: any) => {
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      } else if (this.auction) {
        this.auction.status = "paused";
      }
      this.pushLog("pause", "Auction paused by organizer");
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.AUCTION_RESUMED, (payload: any) => {
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      } else if (this.auction) {
        this.auction.status = "live";
      }
      this.pushLog("resume", "Auction resumed");
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.AUCTION_COMPLETED, (payload: any) => {
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      } else if (this.auction) {
        this.auction.status = "completed";
      }
      this.pushLog("complete", "Auction completed");
      this.disconnect();
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.RULES_UPDATED, (payload: any) => {
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      }
      this.pushLog("rules", "Auction rules updated");
      this.emit();
    });

    // -----------------------------------------------------------------------
    // Round management
    // -----------------------------------------------------------------------
    this.socket.on(SOCKET_EVENTS.ROUND_ADDED, (payload: any) => {
      if (payload.round) {
        const mapped = mapRound(payload.round);
        if (!this.rounds.find((r) => r.id === mapped.id)) {
          this.rounds = [...this.rounds, mapped].sort((a, b) => a.order - b.order);
        }
      }
      this.pushLog("round", `Round ${payload.round?.name} added`);
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.ROUND_UPDATED, (payload: any) => {
      if (payload.round) {
        const mapped = mapRound(payload.round);
        const idx = this.rounds.findIndex((r) => r.id === mapped.id);
        if (idx >= 0) {
          this.rounds[idx] = mapped;
        }
      }
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.ROUND_DELETED, (payload: any) => {
      const exists = this.rounds.some((r) => r.id === payload.roundId);
      if (exists) {
        this.rounds = this.rounds.filter((r) => r.id !== payload.roundId);
        this.pushLog("round", `Round ${payload.roundName} deleted`);
        this.emit();
      }
    });

    this.socket.on(SOCKET_EVENTS.ROUND_COMPLETED, (payload: any) => {
      const roundId = payload.round?._id || payload.round?.id;
      const round = this.rounds.find((r) => r.id === roundId);
      if (round && round.status !== "completed") {
        round.status = "completed";
        this.pushLog("round_complete", `Round ${round.name || payload.round?.name} completed`);
        this.emit();
      }
    });

    // -----------------------------------------------------------------------
    // Live bidding
    // -----------------------------------------------------------------------
    this.socket.on(SOCKET_EVENTS.LOT_OPENED, (payload: any) => {
      this.currentPlayerId = payload.tournamentPlayerId;
      this.currentRoundId = payload.roundId;
      this.currentBid = { amount: 0, teamId: null };

      if (payload.liveState) {
        this.applyLiveState(payload.liveState);
      }

      // Merge player data if the socket payload includes the populated doc
      if (payload.currentPlayer) {
        const mapped = mapPlayer(payload.currentPlayer);
        const idx = this.players.findIndex((p) => p.id === mapped.id);
        if (idx >= 0) {
          this.players[idx] = { ...this.players[idx], ...mapped, status: "current" };
        } else {
          this.players.push({ ...mapped, status: "current" });
        }
      } else {
        const player = this.players.find((p) => p.id === payload.tournamentPlayerId);
        if (player && player.status !== "current") {
          player.status = "current";
        }
      }

      if (payload.currentRound) {
        const mapped = mapRound(payload.currentRound);
        const idx = this.rounds.findIndex((r) => r.id === mapped.id);
        if (idx >= 0) this.rounds[idx] = mapped;
      }

      this.pushLog(
        "lot_open",
        `Lot opened for ${this.players.find((p) => p.id === payload.tournamentPlayerId)?.name || payload.tournamentPlayerId}`
      );
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.BID_PLACED, (payload: any) => {
      this.currentBid = { amount: payload.amount, teamId: payload.teamId };

      if (payload.liveState) {
        this.applyLiveState(payload.liveState);
      }

      if (payload.bid) {
        const bid = mapBid(payload.bid);
        const exists = this.bidHistory.some((b) => b.id === bid.id);
        if (!exists) {
          this.bidHistory = [{ ...bid, isUser: false }, ...this.bidHistory];
        }
      }

      const franchise = this.franchises.find((f) => f.id === payload.teamId);
      this.pushLog(
        "bid",
        `${franchise?.shortName || payload.teamName || "Unknown"} bids ${formatQuick(payload.amount)}`
      );

      // Anti-snipe: mirror the backend reset client-side for instant feedback
      const resetSeconds = this.auction?.rules?.bidResetSeconds ?? 12;
      if (this.timer.remaining < resetSeconds) {
        this.setTimerBaseline(resetSeconds, this.timer.total, true);
      }

      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.LOT_SOLD, (payload: any) => {
      if (payload.liveState) {
        this.applyLiveState(payload.liveState);
      }

      const player = this.players.find((p) => p.id === payload.tournamentPlayerId);
      if (player && player.status !== "sold") {
        player.status = "sold";
        player.teamId = payload.soldToTeamId;
        player.soldPrice = payload.soldPrice;

        const franchise = this.franchises.find((f) => f.id === payload.soldToTeamId);
        if (franchise) {
          if (!franchise.squad.includes(payload.tournamentPlayerId)) {
            franchise.squad.push(payload.tournamentPlayerId);
            franchise.spent += payload.soldPrice;
          }
        }

        this.eventSeq++;
        this.soldEvent = {
          playerId: payload.tournamentPlayerId,
          teamId: payload.soldToTeamId,
          amount: payload.soldPrice,
          seq: this.eventSeq,
        };

        this.pushLog(
          "sold",
          `${player.name || payload.tournamentPlayerId} sold to ${franchise?.name || payload.soldToTeamName} for ${formatQuick(payload.soldPrice)}`
        );
        this.emit();
      }
    });

    this.socket.on(SOCKET_EVENTS.LOT_UNSOLD, (payload: any) => {
      if (payload.liveState) {
        this.applyLiveState(payload.liveState);
      }

      const player = this.players.find((p) => p.id === payload.tournamentPlayerId);
      if (player && player.status !== "unsold") {
        player.status = "unsold";

        this.eventSeq++;
        this.unsoldEvent = {
          playerId: payload.tournamentPlayerId,
          seq: this.eventSeq,
        };

        this.pushLog("unsold", `${player.name || payload.tournamentPlayerId} marked unsold`);
        this.emit();
      }
    });

    this.socket.on(SOCKET_EVENTS.LIVE_STATE_UPDATED, (payload: any) => {
      if (payload.liveState) {
        this.applyLiveState(payload.liveState);
        this.emit();
      }
    });

    // -----------------------------------------------------------------------
    // Presence
    // -----------------------------------------------------------------------
    this.socket.on(SOCKET_EVENTS.VIEWER_COUNT_UPDATED, (payload: any) => {
      // Backend emits either a raw number or { count, source, viewerId }
      this.viewerCount = typeof payload === "number" ? payload : payload.count ?? this.viewerCount;
      this.emit();
    });

    // -----------------------------------------------------------------------
    // Connection resilience
    // -----------------------------------------------------------------------
    this.socket.on("disconnect", (reason: string) => {
      if (this.intentionalDisconnect) return;
      this.connection = "reconnecting";
      this.pushLog("disconnect", `Socket disconnected (${reason}) — reconnecting…`);
      this.emit();
    });

    this.socket.on("reconnect", () => {
      this.connection = "connected";
      this.socket?.emit("join:auction", this.auctionId);
      this.pushLog("connect", "Reconnected to live auction room");
      // Re-hydrate to catch anything missed while disconnected
      this.refreshSnapshot();
      this.emit();
    });

    this.socket.on("reconnect_failed", () => {
      this.connection = "offline";
      this.pushLog("disconnect", "Socket reconnection failed");
      this.emit();
    });
  }

  private applyLiveState(liveState: any) {
    this.currentBid = {
      amount: liveState.currentHighestBid ?? 0,
      teamId: liveState.highestBidderTeamId ?? null,
    };
    this.currentPlayerId = liveState.currentTournamentPlayerId ?? null;
    this.currentRoundId = liveState.currentRoundId ?? null;

    const total = this.auction?.rules?.lotTimerSeconds ?? 30;
    const remaining = liveState.remainingTimeSeconds ?? 0;
    const isRunning = liveState.lotStatus === "BIDDING" || liveState.lotStatus === "bidding";

    this.setTimerBaseline(remaining, total, isRunning);
    this.lastVersion = liveState.version ?? this.lastVersion;
  }

  disconnect() {
    this.intentionalDisconnect = true;
    this.connection = "offline";
    if (this.socket) {
      if (this.auctionId) {
        this.socket.emit("leave:auction", this.auctionId);
      }
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.reconcileHandle) clearInterval(this.reconcileHandle);
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.reconcileHandle = null;
    this.tickHandle = null;
    this.emit();
  }

  destroy() {
    this.destroyed = true;
    this.disconnect();
    this.listeners.clear();
  }

  // ---------------------------------------------------------------------------
  // Pub/sub
  // ---------------------------------------------------------------------------
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.auction) listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  private emit() {
    if (this.destroyed) return;
    const snapshot = this.getSnapshot();
    this.listeners.forEach((l) => l(snapshot));
  }

  getSnapshot(): LiveAuctionSnapshot {
    const playersSoldCount = this.players.filter((p) => p.status === "sold").length;
    const playersUnsoldCount = this.players.filter((p) => p.status === "unsold").length;
    const totalMoneySpent = this.franchises.reduce((sum, f) => sum + f.spent, 0);

    return {
      auction: this.auction ? { ...this.auction } : ({} as Auction),
      rounds: this.rounds.map((r) => ({ ...r })),
      players: this.players.map((p) => ({ ...p })),
      franchises: this.franchises.map((f) => ({ ...f, squad: [...f.squad] })),
      status: (this.auction?.status as any) || "draft",
      currentRoundId: this.currentRoundId,
      currentPlayerId: this.currentPlayerId,
      currentBid: { ...this.currentBid },
      timer: { ...this.timer },
      bidHistory: [...this.bidHistory].slice(0, 200),
      logs: [...this.logs].slice(0, 80),
      soldEvent: this.soldEvent,
      unsoldEvent: this.unsoldEvent,
      connection: this.connection,
      serverLatencyMs: this.latency,
      playersSoldCount,
      playersUnsoldCount,
      totalMoneySpent,
      viewerCount: this.viewerCount,
    };
  }

  private pushLog(type: any, message: string) {
    this.logs.unshift({ id: uid("log"), type, message, timestamp: Date.now() });
  }

  // ---------------------------------------------------------------------------
  // Local countdown interpolation between updates
  // ---------------------------------------------------------------------------
  private tick() {
    if (!this.timer.isRunning) return;
    const elapsed = (Date.now() - this.timerSyncedAt) / 1000;
    const next = Math.max(0, this.timerSyncedRemaining - elapsed);
    if (next !== this.timer.remaining) {
      this.timer.remaining = next;
      this.emit();
    }
  }

  private setTimerBaseline(remaining: number, total: number, isRunning: boolean) {
    this.timer = { remaining, total, isRunning };
    this.timerSyncedAt = Date.now();
    this.timerSyncedRemaining = remaining;
  }

  // ---------------------------------------------------------------------------
  // Snapshot fetch — reconciliation / initial hydration
  // ---------------------------------------------------------------------------
  private async refreshSnapshot() {
    if (!this.auctionId || this.destroyed) return;
    try {
      const start = Date.now();
      const snapshot = await auctionApi.getSnapshot(this.auctionId);
      this.latency = Date.now() - start;

      const unchanged = snapshot.version === this.lastVersion && this.auction !== null;
      this.lastVersion = snapshot.version;

      // Capture previous players BEFORE overwriting for transition detection
      const previousPlayers = this.players;

      this.auction = snapshot.auction;
      this.rounds = snapshot.rounds;
      this.franchises = snapshot.franchises;
      this.players = snapshot.players;
      this.currentRoundId = snapshot.currentRoundId;
      this.currentPlayerId = snapshot.currentPlayerId;
      this.currentBid = snapshot.currentBid;
      this.bidHistory = snapshot.bidHistory;
      this.viewerCount = snapshot.viewerCount ?? 0;
      this.setTimerBaseline(snapshot.timer.remaining, snapshot.timer.total, snapshot.timer.isRunning);

      if (!unchanged) {
        this.detectSoldUnsoldEvents(previousPlayers);
      }

      // Merge server logs with client-only logs
      const serverLogIds = new Set(snapshot.logs.map((l) => l.id));
      const clientOnlyLogs = this.logs.filter((l) => !serverLogIds.has(l.id) && l.id.startsWith("log_"));
      this.logs = [...clientOnlyLogs, ...snapshot.logs]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 80);

      if (this.connection === "reconnecting" || this.connection === "connecting") {
        this.connection = "connected";
      }
      this.emit();
    } catch (err: any) {
      this.connection = "reconnecting";
      this.emit();
    }
  }

  private detectSoldUnsoldEvents(previousPlayers: Player[]) {
    const prevById = new Map(previousPlayers.map((p) => [p.id, p]));
    for (const player of this.players) {
      const prev = prevById.get(player.id);
      if (prev?.status === player.status) continue;

      if (player.status === "sold" && player.teamId) {
        this.eventSeq++;
        this.soldEvent = {
          playerId: player.id,
          teamId: player.teamId,
          amount: player.soldPrice || 0,
          seq: this.eventSeq,
        };
      } else if (player.status === "unsold") {
        this.eventSeq++;
        this.unsoldEvent = { playerId: player.id, seq: this.eventSeq };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Commands (REST — mutations still go via HTTP)
  // ---------------------------------------------------------------------------
  async start() {
    if (!this.auctionId) return;
    try {
      this.auction = await auctionApi.startAuction(this.auctionId);
      this.pushLog("start", "Auction has started");
      // Socket event will arrive momentarily; refresh immediately for sync
      await this.refreshSnapshot();
      this.emit();
    } catch (e: any) {
      this.pushLog("start", `Start failed: ${e.message}`);
      this.emit();
    }
  }

  async pause() {
    if (!this.auctionId) return;
    try {
      this.auction = await auctionApi.pauseAuction(this.auctionId);
      this.pushLog("pause", "Auction paused by organizer");
      this.emit();
    } catch (e: any) {
      this.pushLog("pause", `Pause failed: ${e.message}`);
      this.emit();
    }
  }

  async resume() {
    if (!this.auctionId) return;
    try {
      this.auction = await auctionApi.resumeAuction(this.auctionId);
      this.pushLog("resume", "Auction resumed");
      await this.refreshSnapshot();
      this.emit();
    } catch (e: any) {
      this.pushLog("resume", `Resume failed: ${e.message}`);
      this.emit();
    }
  }

  async complete() {
    if (!this.auctionId) return;
    try {
      this.auction = await auctionApi.completeAuction(this.auctionId);
      this.pushLog("complete", "Auction completed");
      this.disconnect();
      this.emit();
    } catch (e: any) {
      this.pushLog("complete", `Complete failed: ${e.message}`);
      this.emit();
    }
  }

  async openNextLot() {
    if (!this.auctionId || !this.auction) return;
    const orderedRounds = [...this.rounds].sort((a, b) => a.order - b.order);
    const flat = orderedRounds.flatMap((r) => r.playerIds);
    const nextPlayerId = flat.find((pid) => {
      const p = this.players.find((pl) => pl.id === pid);
      return p?.status === "pending";
    });

    if (!nextPlayerId) {
      await this.complete();
      return;
    }

    const round = this.rounds.find((r) => r.playerIds.includes(nextPlayerId));
    if (!round) return;

    try {
      await liveAuctionApi.openLot(this.auctionId, nextPlayerId, round.id);
      this.pushLog("lot_open", `Lot opened for player ${nextPlayerId}`);
      // Socket will push the official update; refresh for safety
      await this.refreshSnapshot();
      this.emit();
    } catch (e: any) {
      this.pushLog("lot_open", `Open lot failed: ${e.message}`);
      this.emit();
    }
  }

  async placeBid(
    teamId: string,
    amount?: number,
    isUser = false
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!this.auctionId || !this.auction) {
      return { ok: false, reason: "No active auction" };
    }
    if (!this.currentPlayerId) {
      return { ok: false, reason: "No active lot" };
    }
    if (this.currentBid.teamId === teamId) {
      return { ok: false, reason: "You are already the highest bidder" };
    }

    const franchise = this.franchises.find((f) => f.id === teamId);
    if (!franchise) return { ok: false, reason: "Unknown franchise" };

    const nextAmount = amount ?? getNextBidAmount(this.currentBid.amount, this.auction.rules.bidIncrements);
    const remainingPurse = franchise.purseTotal - franchise.spent;
    if (nextAmount > remainingPurse) return { ok: false, reason: "Insufficient purse remaining" };
    if (franchise.squad.length >= franchise.maxSquadSize) return { ok: false, reason: "Squad is full" };

    const player = this.players.find((p) => p.id === this.currentPlayerId);
    if (player?.overseas) {
      const overseasCount = franchise.squad.filter((pid) => this.players.find((p) => p.id === pid)?.overseas).length;
      if (overseasCount >= franchise.maxOverseas) return { ok: false, reason: "Overseas quota reached" };
    }

    try {
      const createdBid = await bidApi.placeBid(this.auctionId, { amount: nextAmount, teamId });
      this.currentBid = { amount: nextAmount, teamId };
      this.bidHistory = [{ ...createdBid, isUser }, ...this.bidHistory];
      this.pushLog("bid", `${franchise.shortName} bids ${formatQuick(nextAmount)}${isUser ? " (You)" : ""}`);

      const resetSeconds = this.auction.rules.bidResetSeconds;
      if (this.timer.remaining < resetSeconds) {
        this.setTimerBaseline(resetSeconds, this.timer.total, true);
      }

      this.emit();
      // The socket will arrive with the authoritative update; give it a moment
      // then reconcile. This also catches any concurrent bids we missed.
      setTimeout(() => this.refreshSnapshot(), 300);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: e.message || "Bid rejected" };
    }
  }

  async forceSold() {
    if (!this.auctionId || !this.currentPlayerId || !this.currentBid.teamId) return;
    try {
      await liveAuctionApi.markSold(this.auctionId, this.currentPlayerId, this.currentBid.teamId, this.currentBid.amount);
      this.pushLog("sold", `Force sold ${this.currentPlayerId}`);
      await this.refreshSnapshot();
      this.emit();
    } catch (e: any) {
      this.pushLog("sold", `Force sold failed: ${e.message}`);
    }
  }

  async forceUnsold() {
    if (!this.auctionId || !this.currentPlayerId) return;
    try {
      await liveAuctionApi.markUnsold(this.auctionId, this.currentPlayerId);
      this.pushLog("unsold", `Force unsold ${this.currentPlayerId}`);
      await this.refreshSnapshot();
      this.emit();
    } catch (e: any) {
      this.pushLog("unsold", `Force unsold failed: ${e.message}`);
    }
  }
}

function formatQuick(amount: number) {
  if (amount >= 100) return `₹${(amount / 100).toFixed(amount % 100 === 0 ? 0 : 2)} Cr`;
  return `₹${amount} L`;
}