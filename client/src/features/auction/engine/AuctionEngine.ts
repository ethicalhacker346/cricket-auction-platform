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
import { StateDiffEmitter } from '@/features/auction/audio/StateDiffEmitter';

type Listener = (snapshot: LiveAuctionSnapshot) => void;

const RECONCILE_INTERVAL_MS = 10000;
const TICK_INTERVAL_MS = 250;

/**
 * AuctionEngine — Production-hardened live auction state machine.
 *
 * Lifecycle guarantees:
 *   1. Reconciliation is sequential (setTimeout chain), never overlapping.
 *   2. Terminal state ("completed") stops ALL timers, sockets, and pending
 *      callbacks via stopForTerminalState().
 *   3. Connection generation invalidates stale callbacks from previous
 *      connect() calls (prevents cross-auction races).
 *   4. Every delayed setTimeout checks generation + destroyed + intentionalDisconnect
 *      before executing.
 *   5. connect() aborts immediately if the initial snapshot is already completed.
 */
export class AuctionEngine {
  private auctionId: string | null = null;
  private tournamentId: string | null = null;
  private listeners = new Set<Listener>();
  private socket: Socket | null = null;
  private intentionalDisconnect = false;
  private diffEmitter = new StateDiffEmitter();

  private auction: Auction | null = null;
  private rounds: AuctionRound[] = [];
  private players: Player[] = [];
  private franchises: Franchise[] = [];
  private bidHistory: Bid[] = [];
  private logs: AuctionLog[] = [];

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
  private permanentUnsoldEvent: { playerId: string; seq: number } | null = null;
  private eventSeq = 0;
  private connection: LiveAuctionSnapshot["connection"] = "connecting";
  private latency = 40;

  private reconcileHandle: ReturnType<typeof setTimeout> | null = null;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  private connectionGeneration = 0;
  private pendingSnapshotTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {}

  getAuctionId() {
    return this.auctionId;
  }

  isTerminal(): boolean {
    return this.isTerminalStatus(this.auction?.status);
  }
  isConnected() {
    return (
      this.connection === "connected" &&
      this.auctionId !== null &&
      !this.isTerminalStatus(this.auction?.status)
    );
  }

  async connect(auctionId: string, tournamentId: string) {
    if (this.destroyed) return;

    // Never resurrect an already-completed auction.
    if (
      this.auctionId === auctionId &&
      this.isTerminal()
    ) {
      this.intentionalDisconnect = true;
      this.connection = "offline";
      this.emit();
      return;
    }

    this.disconnect();

    const generation = ++this.connectionGeneration;

    this.auctionId = auctionId;
    this.tournamentId = tournamentId;
    this.intentionalDisconnect = false;
    this.connection = "connecting";
    this.emit();

    try {
      const shouldContinue = await this.refreshSnapshot();

      if (!shouldContinue || this.destroyed || this.intentionalDisconnect) {
        return;
      }

      let socketReady = false;
      try {
        await this.setupSocket(auctionId, generation);
        socketReady = true;
      } catch (socketErr: any) {
        this.pushLog("disconnect", `Socket unavailable: ${socketErr.message}`);
      }

      if (
        this.destroyed ||
        this.intentionalDisconnect ||
        this.isTerminalStatus(this.auction?.status)
      ) {
        this.stopForTerminalState();
        return;
      }

      this.connection = "connected";
      this.pushLog(
        "connect",
        socketReady ? "Connected to live auction room" : "Connected via REST fallback"
      );
      this.emit();

      this.scheduleReconciliation(generation);
      this.tickHandle = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    } catch (err: any) {
      this.connection = "offline";
      this.pushLog("disconnect", `Connection failed: ${err.message}`);
      this.emit();
    }
  }

  private async setupSocket(auctionId: string, generation: number): Promise<void> {
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

      this.bindSocketEvents(generation);
    });
  }

  private bindSocketEvents(generation: number) {
    if (!this.socket) return;

    this.socket.on(SOCKET_EVENTS.AUCTION_STARTED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      } else if (this.auction) {
        this.auction.status = "live";
      }
      this.pushLog("start", "Auction has started");
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.AUCTION_PAUSED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      } else if (this.auction) {
        this.auction.status = "paused";
      }
      this.pushLog("pause", "Auction paused by organizer");
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.AUCTION_RESUMED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      } else if (this.auction) {
        this.auction.status = "live";
      }
      this.pushLog("resume", "Auction resumed");
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.AUCTION_COMPLETED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      } else if (this.auction) {
        this.auction.status = "completed";
      }
      this.pushLog("complete", "Auction completed");
      this.stopForTerminalState();
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.RULES_UPDATED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      }
      this.pushLog("rules", "Auction rules updated");
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.ROUND_ADDED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
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
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
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
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      const exists = this.rounds.some((r) => r.id === payload.roundId);
      if (exists) {
        this.rounds = this.rounds.filter((r) => r.id !== payload.roundId);
        this.pushLog("round", `Round ${payload.roundName} deleted`);
        this.emit();
      }
    });

    this.socket.on(SOCKET_EVENTS.ROUND_COMPLETED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      const roundId = payload.round?._id || payload.round?.id;
      const round = this.rounds.find((r) => r.id === roundId);
      if (round && round.status !== "completed") {
        round.status = "completed";
        this.pushLog("round_complete", `Round ${round.name || payload.round?.name} completed`);
        this.emit();
        this.pendingSnapshotTimeout = setTimeout(() => {
          this.pendingSnapshotTimeout = null;
          if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
          this.refreshSnapshot();
        }, 600);
      }
    });

    this.socket.on(SOCKET_EVENTS.LOT_OPENED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      this.currentPlayerId = payload.tournamentPlayerId;
      this.currentRoundId = payload.roundId;
      this.currentBid = { amount: 0, teamId: null };

      if (payload.liveState) {
        this.applyLiveState(payload.liveState);
      }

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
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
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

      const resetSeconds = this.auction?.rules?.bidResetSeconds ?? 12;
      if (this.timer.remaining < resetSeconds) {
        this.setTimerBaseline(resetSeconds, this.timer.total, true);
      }

      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.LOT_SOLD, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
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
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
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
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (payload.liveState) {
        this.applyLiveState(payload.liveState);
        this.emit();
      }
    });

    this.socket.on(SOCKET_EVENTS.VIEWER_COUNT_UPDATED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      this.viewerCount = typeof payload === "number" ? payload : payload.count ?? this.viewerCount;
      this.emit();
    });

    this.socket.on("disconnect", (reason: string) => {
      if (this.intentionalDisconnect) return;
      this.connection = "reconnecting";
      this.pushLog("disconnect", `Socket disconnected (${reason}) — reconnecting…`);
      this.emit();
    });

    this.socket.on("reconnect", () => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      this.connection = "connected";
      this.socket?.emit("join:auction", this.auctionId);
      this.pushLog("connect", "Reconnected to live auction room");
      this.refreshSnapshot();
      this.emit();
    });

    this.socket.on("reconnect_failed", () => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
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
    this._performCleanup(true);
    this.emit();
  }

  private stopForTerminalState() {
    if (this.connection === "offline" && this.intentionalDisconnect) return;
    this.connectionGeneration++;
    this.intentionalDisconnect = true;
    this.connection = "offline";
    this._performCleanup(true);
    this.emit();
  }

  private _performCleanup(clearPendingSnapshot: boolean) {
    if (clearPendingSnapshot && this.pendingSnapshotTimeout) {
      clearTimeout(this.pendingSnapshotTimeout);
      this.pendingSnapshotTimeout = null;
    }

    if (this.reconcileHandle) {
      clearTimeout(this.reconcileHandle);
      this.reconcileHandle = null;
    }

    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }

    if (this.socket) {
      if (this.auctionId) {
        try {
          this.socket.emit("leave:auction", this.auctionId);
        } catch {
          // socket may already be disconnected
        }
      }
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.diffEmitter.reset();
  }

  destroy() {
    this.destroyed = true;
    this.disconnect();
    this.listeners.clear();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.auction) listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  private emit() {
    if (this.destroyed) return;
    const snapshot = this.getSnapshot();
    this.diffEmitter.emit(snapshot);
    this.listeners.forEach((l) => l(snapshot));
  }

  getSnapshot(): LiveAuctionSnapshot {
    const playersSoldCount = this.players.filter((p) => p.status === "sold").length;
    const playersUnsoldCount = this.players.filter((p) => p.status === "unsold").length;
    const playersPermanentUnsoldCount = this.players.filter((p) => p.status === "permanent_unsold").length;
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
      permanentUnsoldEvent: this.permanentUnsoldEvent,
      connection: this.connection,
      serverLatencyMs: this.latency,
      playersSoldCount,
      playersUnsoldCount,
      playersPermanentUnsoldCount,
      totalMoneySpent,
      viewerCount: this.viewerCount,
    };
  }

  private pushLog(type: any, message: string) {
    this.logs.unshift({ id: uid("log"), type, message, timestamp: Date.now() });
  }

  private tick() {
    if (!this.timer.isRunning || this.isTerminalStatus(this.auction?.status)) return;
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

  private async refreshSnapshot(): Promise<boolean> {
    if (!this.auctionId || this.destroyed || this.intentionalDisconnect) {
      return false;
    }

    try {
      const start = Date.now();
      const snapshot = await auctionApi.getSnapshot(this.auctionId);
      this.latency = Date.now() - start;

      if (this.destroyed || this.intentionalDisconnect) {
        return false;
      }

      const unchanged = snapshot.version === this.lastVersion && this.auction !== null;
      this.lastVersion = snapshot.version;

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

      const serverLogIds = new Set(snapshot.logs.map((l) => l.id));
      const clientOnlyLogs = this.logs.filter((l) => !serverLogIds.has(l.id) && l.id.startsWith("log_"));
      this.logs = [...clientOnlyLogs, ...snapshot.logs]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 80);

      if (this.connection === "reconnecting" || this.connection === "connecting") {
        this.connection = "connected";
      }
      this.emit();

      if (this.isTerminalStatus(snapshot.auction?.status)) {
        this.stopForTerminalState();
        return false;
      }

      return true;
    } catch (err: any) {
      this.connection = "reconnecting";
      this.emit();
      return true;
    }
  }

  private scheduleReconciliation(generation: number) {
    if (
      generation !== this.connectionGeneration ||
      this.destroyed ||
      this.intentionalDisconnect ||
      !this.auctionId ||
      this.isTerminalStatus(this.auction?.status)
    ) {
      return;
    }

    this.reconcileHandle = setTimeout(async () => {
      this.reconcileHandle = null;

      if (
        generation !== this.connectionGeneration ||
        this.destroyed ||
        this.intentionalDisconnect ||
        !this.auctionId
      ) {
        return;
      }

      const shouldContinue = await this.refreshSnapshot();

      if (
        shouldContinue &&
        generation === this.connectionGeneration &&
        !this.destroyed &&
        !this.intentionalDisconnect
      ) {
        this.scheduleReconciliation(generation);
      }
    }, RECONCILE_INTERVAL_MS);
  }

  private isTerminalStatus(status: string | undefined): boolean {
    return status === "completed";
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
      } else if (player.status === "permanent_unsold") {
        this.eventSeq++;
        this.permanentUnsoldEvent = { playerId: player.id, seq: this.eventSeq };
      }
    }
  }

  async start(): Promise<{ success: boolean; error?: string }> {
    if (!this.auctionId) return { success: false, error: "No active auction" };
    try {
      this.auction = await auctionApi.startAuction(this.auctionId);
      this.pushLog("start", "Auction has started");
      await this.refreshSnapshot();
      this.emit();
      return { success: true };
    } catch (e: any) {
      const msg = e.message || "Start failed";
      this.pushLog("start", `Start failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async pause(): Promise<{ success: boolean; error?: string }> {
    if (!this.auctionId) return { success: false, error: "No active auction" };
    try {
      this.auction = await auctionApi.pauseAuction(this.auctionId);
      this.pushLog("pause", "Auction paused by organizer");
      this.emit();
      return { success: true };
    } catch (e: any) {
      const msg = e.message || "Pause failed";
      this.pushLog("pause", `Pause failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async resume(): Promise<{ success: boolean; error?: string }> {
    if (!this.auctionId) return { success: false, error: "No active auction" };
    try {
      this.auction = await auctionApi.resumeAuction(this.auctionId);
      this.pushLog("resume", "Auction resumed");
      await this.refreshSnapshot();
      this.emit();
      return { success: true };
    } catch (e: any) {
      const msg = e.message || "Resume failed";
      this.pushLog("resume", `Resume failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async complete(): Promise<{ success: boolean; error?: string }> {
    if (!this.auctionId) return { success: false, error: "No active auction" };
    try {
      this.auction = await auctionApi.completeAuction(this.auctionId);
      this.pushLog("complete", "Auction completed");
      this.disconnect();
      this.emit();
      return { success: true };
    } catch (e: any) {
      const msg = e.message || "Complete failed";
      this.pushLog("complete", `Complete failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async openNextLot(): Promise<{ success: boolean; error?: string }> {
    if (!this.auctionId || !this.auction) {
      return { success: false, error: "No active auction" };
    }
    const orderedRounds = [...this.rounds].sort((a, b) => a.order - b.order);
    for (const round of orderedRounds) {
      if (round.status === "completed") continue;
      const nextPlayerId = round.playerIds.find((pid) => {
        const p = this.players.find((pl) => pl.id === pid);
        return p?.status === "pending";
      });
      if (!nextPlayerId) continue;
      try {
        await liveAuctionApi.openLot(this.auctionId, nextPlayerId, round.id);
        this.pushLog("lot_open", `Lot opened for player ${nextPlayerId}`);
        await this.refreshSnapshot();
        this.emit();
        return { success: true };
      } catch (e: any) {
        const msg = e.message || "Open lot failed";
        this.pushLog("lot_open", `Open lot failed: ${msg}`);
        return { success: false, error: msg };
      }
    }
    return { success: false, error: "No remaining players in open rounds" };
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

      const timeoutGen = this.connectionGeneration;
      this.pendingSnapshotTimeout = setTimeout(() => {
        this.pendingSnapshotTimeout = null;
        if (timeoutGen !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
        this.refreshSnapshot();
      }, 300);

      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: e.message || "Bid rejected" };
    }
  }

  async forceSold(): Promise<{ success: boolean; error?: string }> {
    if (!this.auctionId || !this.currentPlayerId || !this.currentBid.teamId) {
      return { success: false, error: "No active lot or winning bid to settle" };
    }
    try {
      await liveAuctionApi.markSold(this.auctionId, this.currentPlayerId, this.currentBid.teamId, this.currentBid.amount);
      this.pushLog("sold", `Force sold ${this.currentPlayerId}`);
      await this.refreshSnapshot();
      this.emit();
      return { success: true };
    } catch (e: any) {
      const msg = e.message || "Force sold failed";
      this.pushLog("sold", `Force sold failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async forceUnsold(): Promise<{ success: boolean; error?: string }> {
    if (!this.auctionId || !this.currentPlayerId) {
      return { success: false, error: "No active lot to settle" };
    }
    try {
      await liveAuctionApi.markUnsold(this.auctionId, this.currentPlayerId);
      this.pushLog("unsold", `Force unsold ${this.currentPlayerId}`);
      await this.refreshSnapshot();
      this.emit();
      return { success: true };
    } catch (e: any) {
      const msg = e.message || "Force unsold failed";
      this.pushLog("unsold", `Force unsold failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async markPermanentUnsold(tournamentPlayerId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.auctionId) {
      return { success: false, error: "No active auction" };
    }
    try {
      await liveAuctionApi.markPermanentUnsold(this.auctionId, tournamentPlayerId);
      this.pushLog("permanent_unsold_marked", `Player ${tournamentPlayerId} marked permanently unsold`);
      await this.refreshSnapshot();
      this.emit();
      return { success: true };
    } catch (e: any) {
      const msg = e.message || "Failed to mark permanent unsold";
      this.pushLog("permanent_unsold_marked", `Mark permanent unsold failed: ${msg}`);
      return { success: false, error: msg };
    }
  }
}

function formatQuick(amount: number) {
  if (amount >= 100) return `₹${(amount / 100).toFixed(amount % 100 === 0 ? 0 : 2)} Cr`;
  return `₹${amount} L`;
}