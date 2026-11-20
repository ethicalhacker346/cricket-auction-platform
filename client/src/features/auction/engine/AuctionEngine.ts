import { auctionCommandId, requestBackoffMs } from "../utils/requestBackoff";
import { getAuctionViewerId } from "../utils/viewerIdentity";
import type {
  Auction,
  AuctionLog,
  AuctionRound,
  Bid,
  Franchise,
  LiveAuctionSnapshot,
  LotTimeCommandResult,
  LotDecisionTarget,
  Player,
} from "../types/index.types";
import { eligibleRoundPlayers, runningAuctionRound } from "../utils/roundSelection";
import { getNextBidAmount } from "@/features/auction/utils/index.utils";
import { uid } from "@/features/auction/utils/index.utils";
import { formatLakhs } from "@/features/auction/utils/index.utils";
import {
  auctionApi,
  bidApi,
  liveAuctionApi,
  mapAuction,
  mapRound,
  mapBid,
  mapPlayer,
} from "@/features/auction/api/index.api";
import { SOCKET_EVENTS, SOCKET_CLIENT_EVENTS, WS_URL } from "@/features/auction/constants/index.constants";
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
 *   - One owned socket/ticker and a sequential reconciliation chain.
 *   - Generations fence every asynchronous response across auction switches.
 *   - Monotonic revisions fence delayed socket frames and REST snapshots.
 *   - Completed auctions stay observable: undo can reopen the final lot.
 *   - Corrections clear verdicts and establish a silent audio baseline.
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
  private undoAction: LiveAuctionSnapshot["undoAction"] = null;
  private undoVersion = 0;
  private lastActionVersion = -1;
  private appliedUndoVersion = 0;

  private soldEvent: LiveAuctionSnapshot["soldEvent"] = null;
  private unsoldEvent: LiveAuctionSnapshot["unsoldEvent"] = null;
  private lastUnsoldVerdictKey = "";
  private permanentUnsoldEvent: { playerId: string; seq: number } | null = null;
  private eventSeq = 0;
  private connection: LiveAuctionSnapshot["connection"] = "connecting";
  private latency = 40;

  private reconcileHandle: ReturnType<typeof setTimeout> | null = null;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  private connectionGeneration = 0;
  private pendingSnapshotTimeout: ReturnType<typeof setTimeout> | null = null;

  private bidInFlight: symbol | null = null;
  private snapshotRequest: { generation: number; auctionId: string; promise: Promise<boolean> } | null = null;
  private snapshotFollowup = false;
  private snapshotFailures = 0;
  private nextSnapshotAt = 0;
  private roomJoined = false;
  private initialSocketAbort: (() => void) | null = null;
  private recoveryListenersBound = false;

  constructor() {}

  // Socket.io's own reconnection loop assumes the process keeps running.
  // Mobile browsers routinely throttle or fully suspend timers and sockets
  // in backgrounded tabs, and a device coming back online after a tunnel/
  // elevator/handoff doesn't always trigger socket.io's internal retry in a
  // timely way. These two browser-level signals force a clean, fresh
  // connect() (new generation, freshly-read token) rather than trusting the
  // stale in-flight socket to sort itself out.
  private handleNetworkRecovery = () => {
    if (this.destroyed || this.intentionalDisconnect || !this.auctionId || !this.tournamentId) return;
    if (this.connection === "offline" || this.connection === "reconnecting") {
      this.connect(this.auctionId, this.tournamentId);
    }
  };

  private handleVisibilityChange = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      this.handleNetworkRecovery();
    }
  };

  private bindRecoveryListeners() {
    if (this.recoveryListenersBound || typeof window === "undefined") return;
    this.recoveryListenersBound = true;
    window.addEventListener("online", this.handleNetworkRecovery);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private unbindRecoveryListeners() {
    if (!this.recoveryListenersBound || typeof window === "undefined") return;
    this.recoveryListenersBound = false;
    window.removeEventListener("online", this.handleNetworkRecovery);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
  }

  getAuctionId() {
    return this.auctionId;
  }

  isTerminal(): boolean {
    return this.isTerminalStatus(this.auction?.status);
  }
  isConnected() {
    return (
      this.connection === "connected" &&
      this.auctionId !== null
    );
  }

  async connect(auctionId: string, tournamentId: string) {
    if (this.destroyed) return;

    this.bindRecoveryListeners();

    // Completion remains observable: an organizer may undo the final sale.
    const changingAuction = this.auctionId !== auctionId;
    this.disconnect();

    const generation = ++this.connectionGeneration;
    if (changingAuction) {
      this.snapshotFailures = 0; this.nextSnapshotAt = 0;
      this.auction = null;
      this.players = []; this.rounds = []; this.franchises = []; this.bidHistory = []; this.logs = [];
      this.currentPlayerId = null; this.currentRoundId = null;
      this.currentBid = { amount: 0, teamId: null };
      this.soldEvent = null; this.unsoldEvent = null; this.permanentUnsoldEvent = null; this.lastUnsoldVerdictKey = "";
      this.undoAction = null; this.undoVersion = 0; this.appliedUndoVersion = 0; this.lastActionVersion = -1; this.lastVersion = -1;
      this.setTimerBaseline(0, 0, false);
    }

    this.auctionId = auctionId;
    this.tournamentId = tournamentId;
    this.intentionalDisconnect = false;
    this.connection = "connecting";
    this.emit();

    try {
      const shouldContinue = await this.refreshSnapshot();

      if (!shouldContinue || !this.isCurrent(generation, auctionId)) {
        return;
      }

      let socketReady = false;
      try {
        await this.setupSocket(auctionId, generation);
        socketReady = true;
      } catch (socketErr: any) {
        if (!this.isCurrent(generation, auctionId)) return;
        this.pushLog("disconnect", `Socket unavailable: ${socketErr.message}`);
      }

      if (!this.isCurrent(generation, auctionId)) return;

      this.connection = socketReady || (this.auction?.id === auctionId && this.snapshotFailures === 0) ? 'connected' : 'reconnecting';
      this.pushLog(
        this.connection === 'connected' ? 'connect' : 'disconnect',
        socketReady ? 'Connected to live auction room' : this.connection === 'connected' ? 'Connected via REST fallback' : 'Waiting for the live room to recover'
      );
      this.emit();

      this.scheduleReconciliation(generation);
      this.tickHandle = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    } catch (err: any) {
      if (!this.isCurrent(generation, auctionId)) return;
      this.connection = "offline";
      this.pushLog("disconnect", `Connection failed: ${err.message}`);
      this.emit();
    }
  }

  private async setupSocket(auctionId: string, generation: number): Promise<void> {
    const socket = io(resolveSocketOrigin(WS_URL), {
      // Always pin the transport path explicitly. Without this, a
      // VITE_SOCKET_URL that carries any path segment (e.g. the API URL's
      // "/api/v1", or someone pasting ".../socket.io") is parsed by
      // socket.io-client as a NAMESPACE — the server has no such namespace
      // and every attempt fails with "Invalid namespace" (the exact error
      // that used to spam the activity timeline and force REST fallback).
      path: "/socket.io",
      // A static { token } object is captured once and reused verbatim on
      // every socket.io reconnection attempt, including after the access
      // token has rotated during a long-running auction — every retry after
      // rotation would then auth with a dead token. Passing a function makes
      // socket.io re-read the store immediately before each attempt.
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // Unlimited attempts with a capped, jittered backoff (socket.io's
      // default randomizationFactor already adds jitter). A finite cap like
      // 10 exhausts in roughly 30-50s — well within a real 3G/4G handoff or
      // tunnel/elevator gap — and there was previously no recovery path back
      // from "offline" once attempts ran out short of a full page reload.
      // Actual runaway retries are still bounded by the network/visibility
      // recovery hooks below, which force a clean reconnect() instead of
      // letting this loop spin forever in a backgrounded tab.
      reconnectionAttempts: Infinity,
    });

    this.socket = socket;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (this.initialSocketAbort === abort) this.initialSocketAbort = null;
        if (error) reject(error); else resolve();
      };
      const abort = () => finish(new Error('Socket connection cancelled'));
      const timeout = setTimeout(() => finish(new Error('Socket connection timeout')), 10_000);
      this.initialSocketAbort = abort;
      // Socket.IO emits connect on the Socket for initial AND later connects;
      // reconnect is a Manager event, not a Socket event.
      socket.on('connect', () => {
        if (!this.isCurrent(generation, auctionId)) { abort(); return; }
        this.joinAuctionRoom(auctionId, generation);
        if (settled) {
          this.connection = 'connected';
          this.pushLog('connect', 'Reconnected to live auction room');
          void this.refreshSnapshot();
          this.emit();
        } else finish();
      });
      socket.on('connect_error', (error: Error) => finish(error));
      this.bindSocketEvents(generation);
    });
  }

  /**
   * Join the server-side `auction:{id}` room — without this the socket
   * receives nothing, since every broadcast is room-scoped. The backend
   * handler (auction.handler.js) expects `auction:join` with a payload
   * object and acks with the current viewer count + live state.
   */
  private joinAuctionRoom(auctionId: string, generation: number) {
    if (!this.socket) return;
    this.socket.emit(
      SOCKET_CLIENT_EVENTS.JOIN_AUCTION,
      { auctionId, viewerId: getAuctionViewerId() },
      (res: any) => {
        if (
          generation !== this.connectionGeneration ||
          this.destroyed ||
          this.intentionalDisconnect
        ) {
          return;
        }
        if (res?.success && typeof res.data?.viewerCount === "number") {
          this.roomJoined = true;
          this.viewerCount = res.data.viewerCount;
          this.emit();
        }
      }
    );
  }

  private bindSocketEvents(generation: number) {
    if (!this.socket) return;

    this.socket.on(SOCKET_EVENTS.AUCTION_STARTED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
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
      if (!this.acceptEvent(payload)) return;
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      } else if (this.auction) {
        this.auction.status = "paused";
      }
      // The server freezes its lot timer while paused — mirror that locally
      // or the countdown keeps running and shows a phantom expiry.
      if (payload.auction?.liveState) this.applyLiveState(payload.auction.liveState);
      else this.setTimerBaseline(this.timer.remaining, this.timer.total, false);
      this.pushLog("pause", "Auction paused by organizer");
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.AUCTION_RESUMED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      } else if (this.auction) {
        this.auction.status = "live";
      }
      this.pushLog("resume", "Auction resumed");
      // Re-sync the lot clock — the server's remaining time was frozen at
      // pause and re-baselined at resume, so our frozen local value is stale.
      this.refreshSnapshot();
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.AUCTION_COMPLETED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      } else if (this.auction) {
        this.auction.status = "completed";
      }
      this.pushLog("complete", "Auction completed");
      this.setTimerBaseline(0, this.timer.total, false);
      void this.refreshSnapshot();
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.RULES_UPDATED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
      if (payload.auction) {
        this.auction = mapAuction(payload.auction);
      }
      this.pushLog("rules", "Auction rules updated");
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.ROUND_ADDED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
      if (payload.round) {
        const mapped = mapRound(payload.round);
        if (!this.rounds.find((r) => r.id === mapped.id)) {
          this.rounds = [...this.rounds, mapped].sort((a, b) => a.order - b.order);
        }
        if (mapped.type === 'unsold' && Array.isArray(payload.relistedPlayerIds)) {
          const members = new Set(mapped.playerIds);
          const relisted = new Set(payload.relistedPlayerIds.filter((id: string) => members.has(id)));
          this.players = this.players.map((player) => relisted.has(player.id)
            ? { ...player, status: 'pending', auctionRoundId: mapped.id } : player);
          if (payload.liveState) this.applyLiveState(payload.liveState);
        }
      }
      this.pushLog("round", `Round ${payload.round?.name} added`);
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.ROUND_UPDATED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
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
      if (!this.acceptEvent(payload)) return;
      const exists = this.rounds.some((r) => r.id === payload.roundId);
      if (exists) {
        this.rounds = this.rounds.filter((r) => r.id !== payload.roundId);
        this.pushLog("round", `Round ${payload.roundName} deleted`);
        this.emit();
      }
    });

    this.socket.on(SOCKET_EVENTS.ROUND_COMPLETED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
      const roundId = payload.round?._id || payload.round?.id;
      const round = this.rounds.find((r) => r.id === roundId);
      if (round && round.status !== "completed") {
        Object.assign(round, payload.round ? mapRound(payload.round) : {}, { status: 'completed' });
        this.pushLog("round_complete", `Round ${round.name || payload.round?.name} completed`);
        this.emit();
        this.scheduleSnapshot(600, generation);
      }
    });

    this.socket.on(SOCKET_EVENTS.LOT_OPENED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
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
          player.auctionRoundId = payload.roundId;
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
      if (!this.acceptEvent(payload)) return;
      this.currentBid = { amount: payload.amount, teamId: payload.teamId };

      if (payload.liveState) {
        this.applyLiveState(payload.liveState);
      }

      if (payload.bid) {
        const bid = mapBid(payload.bid);
        const exists = this.bidHistory.some((b) => b.id === bid.id);
        if (!exists) {
          // Capped here too, not just in getSnapshot()'s slice — same
          // unbounded-growth issue as the logs array above.
          this.bidHistory = [{ ...bid, isUser: false }, ...this.bidHistory].slice(0, 200);
        }
      }

      const franchise = this.franchises.find((f) => f.id === payload.teamId);
      this.pushLog(
        "bid",
        `${franchise?.shortName || payload.teamName || "Unknown"} bids ${formatLakhs(payload.amount)}`
      );

      const resetSeconds = this.auction?.rules?.bidResetSeconds ?? 12;
      if (this.timer.remaining < resetSeconds) {
        this.setTimerBaseline(resetSeconds, this.timer.total, true);
      }

      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.LOT_SOLD, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
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
          `${player.name || payload.tournamentPlayerId} sold to ${franchise?.name || payload.soldToTeamName} for ${formatLakhs(payload.soldPrice)}`
        );
        this.emit();
      }
    });

    this.socket.on(SOCKET_EVENTS.LOT_UNSOLD, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
      if (payload.liveState) {
        this.applyLiveState(payload.liveState);
      }

      const player = this.players.find((p) => p.id === payload.tournamentPlayerId);
      const verdictKey = `${payload.tournamentPlayerId}:${payload.roundId}:${payload.version ?? this.lastVersion}`;
      if (player && verdictKey !== this.lastUnsoldVerdictKey) {
        this.lastUnsoldVerdictKey = verdictKey;
        // A successor/relist frame may arrive before its same-revision verdict.
        // Preserve the new queue assignment while still showing the old result once.
        if (!player.auctionRoundId || !payload.roundId || player.auctionRoundId === payload.roundId) player.status = 'unsold';

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
      if (!this.acceptEvent(payload)) return;
      if (payload.liveState) {
        this.applyLiveState(payload.liveState);
        this.emit();
      }
    });

    this.socket.on(SOCKET_EVENTS.VIEWER_COUNT_UPDATED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      // Server payload: { auctionId, viewerCount, timestamp } — previously
      // read `payload.count`, a field that never existed, so live viewer
      // counts were silently dropped.
      this.viewerCount =
        typeof payload === "number"
          ? payload
          : payload.viewerCount ?? payload.count ?? this.viewerCount;
      this.emit();
    });

    // A player being retired from the unsold pool — mirrors the LOT_SOLD /
    // LOT_UNSOLD handlers so every client animates it without waiting for
    // the next reconciliation snapshot.
    this.socket.on(SOCKET_EVENTS.LOT_PERMANENT_UNSOLD, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
      if (payload.liveState) this.applyLiveState(payload.liveState);
      const player = this.players.find((p) => p.id === payload.tournamentPlayerId);
      if (player && player.status !== "permanent_unsold") {
        player.status = "permanent_unsold";
        this.eventSeq++;
        this.permanentUnsoldEvent = { playerId: player.id, seq: this.eventSeq };
        this.pushLog(
          "permanent_unsold_marked",
          `${player.name || payload.tournamentPlayerId} marked permanently unsold`
        );
        this.emit();
      }
    });

    this.socket.on(SOCKET_EVENTS.LOT_TIME_EXTENDED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
      if (this.auction && payload.status) this.auction.status = String(payload.status).toLowerCase() as Auction['status'];
      if (payload.liveState) this.applyLiveState(payload.liveState);
      this.pushLog('lot_time_extended', `Organizer added ${payload.seconds} seconds to this lot`);
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.ACTION_RECORDED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload) || payload.version < this.lastActionVersion) return;
      this.lastActionVersion = payload.version;
      this.undoAction = payload.action ?? null;
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.ACTION_UNDONE, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
      this.acceptUndo(payload);
      void this.refreshSnapshot();
    });

    // ---------- Server-authoritative lot timer ----------
    // The server broadcasts a full sync every ~5s (and on every bid reset).
    // Adopting it as the baseline keeps the local 250ms interpolation
    // pinned to the server clock instead of drifting for the whole lot.
    this.socket.on(SOCKET_EVENTS.TIMER_SYNC, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload) || this.auction?.status !== "live") return;
      if (typeof payload?.remaining !== "number") return;
      const total = payload.total ?? this.timer.total;
      this.setTimerBaseline(Math.max(0, payload.remaining), total, true);
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.TIMER_EXPIRED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
      this.setTimerBaseline(0, this.timer.total, false);
      this.emit();
    });

    this.socket.on(SOCKET_EVENTS.TIMER_STOPPED, (payload: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      if (!this.acceptEvent(payload)) return;
      this.setTimerBaseline(this.timer.remaining, this.timer.total, false);
      this.emit();
    });

    this.socket.on("disconnect", (reason: string) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      this.roomJoined = false;
      this.connection = "reconnecting";
      this.pushLog("disconnect", `Socket disconnected (${reason}) — reconnecting…`);
      this.emit();
    });

    // The connect_error listener registered inside setupSocket()'s promise
    // only matters for the very first connection attempt — the promise
    // settles after that, and any connect_error fired by later background
    // reconnection attempts was previously going nowhere. Auth errors in
    // particular are worth surfacing distinctly: retrying a dead token in a
    // tight backoff loop wastes attempts that would otherwise recover from a
    // transient network blip.
    this.socket.on("connect_error", (err: any) => {
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      const isAuthError =
        err?.message?.toLowerCase().includes("auth") || err?.data?.code === "UNAUTHORIZED";
      if (isAuthError) {
        this.pushLog("disconnect", "Socket auth rejected — will retry with refreshed token");
      }
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

    const total = liveState.timerTotalSeconds || this.auction?.rules?.lotTimerSeconds || 30;
    const remaining = liveState.remainingTimeSeconds ?? 0;
    const isRunning = this.auction?.status === "live" && (liveState.lotStatus === "BIDDING" || liveState.lotStatus === "bidding") && remaining > 0;

    this.setTimerBaseline(remaining, total, isRunning);
    this.lastVersion = Math.max(this.lastVersion, liveState.version ?? -1);
  }

  disconnect() {
    this.intentionalDisconnect = true;
    ++this.connectionGeneration;
    this.bidInFlight = null;
    this.connection = "offline";
    this._performCleanup(true);
    this.emit();
  }

  private isCurrent(generation: number, auctionId: string): boolean {
    return generation === this.connectionGeneration && auctionId === this.auctionId
      && !this.destroyed && !this.intentionalDisconnect;
  }

  private versionOf(payload: any): number | undefined {
    return payload?.version ?? payload?.liveState?.version ?? payload?.auction?.liveState?.version;
  }

  private acceptEvent(payload: any): boolean {
    if (payload?.auctionId && payload.auctionId !== this.auctionId) return false;
    const version = this.versionOf(payload);
    if (Number.isFinite(version)) {
      if (version! < this.lastVersion) return false;
      this.lastVersion = Math.max(this.lastVersion, version!);
    }
    return true;
  }

  private acceptUndo(payload: any) {
    const version = this.versionOf(payload) ?? 0;
    // REST and Socket.IO may deliver the same correction in either order.
    if (version <= this.undoVersion) return;
    if (payload.auction) this.auction = mapAuction({
      ...payload.auction, tournamentName: this.auction?.tournamentName,
      organizer: this.auction?.organizer, season: this.auction?.season,
    });
    this.undoAction = payload.action ?? payload.nextAction ?? null;
    this.undoVersion = version;
    this.lastActionVersion = Math.max(this.lastActionVersion, version);
    this.soldEvent = null; this.unsoldEvent = null; this.permanentUnsoldEvent = null;
    this.diffEmitter.reset();
    const live = payload.liveState ?? payload.auction?.liveState;
    if (live) this.applyLiveState(live);
    this.emit();
  }

  private scheduleSnapshot(delay: number, generation: number) {
    if (this.pendingSnapshotTimeout) clearTimeout(this.pendingSnapshotTimeout);
    this.pendingSnapshotTimeout = setTimeout(() => {
      this.pendingSnapshotTimeout = null;
      if (generation !== this.connectionGeneration || this.destroyed || this.intentionalDisconnect) return;
      void this.refreshSnapshot();
    }, delay);
  }

  private _performCleanup(clearPendingSnapshot: boolean) {
    this.snapshotRequest = null;
    this.snapshotFollowup = false;
    this.roomJoined = false;
    this.initialSocketAbort?.();
    this.initialSocketAbort = null;
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
          this.socket.emit(SOCKET_CLIENT_EVENTS.LEAVE_AUCTION, { auctionId: this.auctionId });
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
    this.unbindRecoveryListeners();
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
      version: Math.max(0, this.lastVersion),
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
      undoAction: this.undoAction,
      undoVersion: this.undoVersion,
    };
  }

  private pushLog(type: any, message: string) {
    // Collapse consecutive duplicates (socket reconnect loops, repeated
    // failures) into one entry with a repeat counter — a timeline that
    // shows the same line ten times is noise, not information.
    const last = this.logs[0];
    if (last && last.type === type) {
      const dupMatch = last.message.match(/^(.*) \(×(\d+)\)$/);
      const base = dupMatch ? dupMatch[1] : last.message;
      if (base === message) {
        last.message = `${message} (×${(dupMatch ? parseInt(dupMatch[2], 10) : 1) + 1})`;
        last.timestamp = Date.now();
        return;
      }
    }
    this.logs.unshift({ id: uid("log"), type, message, timestamp: Date.now() });
    // getSnapshot() only ever returns the first 80, but the backing array
    // was never trimmed itself — over a multi-hour auction (thousands of
    // bid/log events) this grows unbounded in memory for the life of the
    // tab. Matters most on the lower-RAM phones spectators are likely
    // watching from.
    if (this.logs.length > 200) this.logs.length = 200;
  }

  private tick() {
    if (!this.timer.isRunning || this.isTerminalStatus(this.auction?.status)) return;
    // While paused the server freezes the lot clock — the local
    // interpolation must not keep counting down into a phantom expiry.
    if (this.auction?.status === "paused") return;
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

  private refreshSnapshot(): Promise<boolean> {
    if (!this.auctionId || this.destroyed || this.intentionalDisconnect) return Promise.resolve(false);
    const auctionId = this.auctionId;
    const generation = this.connectionGeneration;
    if (Date.now() < this.nextSnapshotAt) return Promise.resolve(true);
    if (this.snapshotRequest?.auctionId === auctionId && this.snapshotRequest.generation === generation) {
      this.snapshotFollowup = true;
      return this.snapshotRequest.promise;
    }
    const request = { auctionId, generation, promise: null as unknown as Promise<boolean> };
    request.promise = this.fetchSnapshot(auctionId, generation).finally(() => {
      if (this.snapshotRequest !== request) return;
      this.snapshotRequest = null;
      if (this.snapshotFollowup && this.isCurrent(generation, auctionId)) {
        this.snapshotFollowup = false;
        this.scheduleSnapshot(Math.max(100, this.nextSnapshotAt - Date.now()), generation);
      }
    });
    this.snapshotRequest = request;
    return request.promise;
  }

  private async fetchSnapshot(requestedAuctionId: string, generation: number): Promise<boolean> {
    try {
      const start = Date.now();
      const snapshot = await auctionApi.getSnapshot(requestedAuctionId);
      if (generation !== this.connectionGeneration || requestedAuctionId !== this.auctionId) return false;
      if (snapshot.version < this.lastVersion) return true;
      this.latency = Date.now() - start;
      this.snapshotFailures = 0; this.nextSnapshotAt = 0;

      if (this.destroyed || this.intentionalDisconnect) {
        return false;
      }

      this.lastVersion = snapshot.version;
      // Even when an undo frame was already received, the first FULL snapshot
      // after it is a correction, not a new unsold/sale/round-complete event.
      const isUndo = (snapshot.undoVersion ?? 0) > this.appliedUndoVersion;
      const unseenUndo = (snapshot.undoVersion ?? 0) > this.undoVersion;
      this.undoVersion = Math.max(this.undoVersion, snapshot.undoVersion ?? 0);
      this.undoAction = snapshot.undoAction ?? null;
      this.lastActionVersion = Math.max(this.lastActionVersion, snapshot.version);
      if (isUndo) {
        if (unseenUndo) { this.soldEvent = null; this.unsoldEvent = null; this.permanentUnsoldEvent = null; }
        this.diffEmitter.reset();
        this.appliedUndoVersion = this.undoVersion;
      }

      // A first snapshot (or a different auction) establishes a baseline;
      // its historical outcomes are not new live verdicts.
      const previousPlayers = this.auction?.id === snapshot.auction.id ? this.players : [];

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

      if (!isUndo) {
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

      return true;
    } catch (error) {
      if (!this.isCurrent(generation, requestedAuctionId)) return false;
      this.snapshotFailures += 1;
      this.nextSnapshotAt = Date.now() + requestBackoffMs(error, this.snapshotFailures);
      // An HTTP 429/503 does not mean a healthy live socket disconnected.
      if (!this.socket?.connected) this.connection = 'reconnecting';
      this.emit();
      return true;
    }
  }

  private scheduleReconciliation(generation: number) {
    if (
      generation !== this.connectionGeneration ||
      this.destroyed ||
      this.intentionalDisconnect ||
      !this.auctionId
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
    }, Math.max(this.isTerminal() ? 30_000 : RECONCILE_INTERVAL_MS, this.nextSnapshotAt - Date.now()));
  }

  private isTerminalStatus(status: string | undefined): boolean {
    return status === "completed";
  }


  private detectSoldUnsoldEvents(previousPlayers: Player[]) {
    const prevById = new Map(previousPlayers.map((p) => [p.id, p]));
    for (const player of this.players) {
      const prev = prevById.get(player.id);
      if (!prev || prev.status === player.status) continue;

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

  private async command(
    request: (auctionId: string) => Promise<unknown>,
    failure: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.auctionId) return { success: false, error: 'No active auction' };
    const auctionId = this.auctionId;
    const generation = this.connectionGeneration;
    try {
      await request(auctionId);
      if (this.isCurrent(generation, auctionId)) await this.refreshSnapshot();
      return { success: true };
    } catch (error: any) {
      if (this.isCurrent(generation, auctionId)) await this.refreshSnapshot();
      return { success: false, error: error.message || failure };
    }
  }

  async heartbeatViewer(auctionId: string, viewerId: string): Promise<{ viewerCount: number }> {
    const socket = this.socket;
    if (auctionId === this.auctionId && socket?.connected && this.roomJoined && typeof socket.timeout === 'function') {
      try {
        const response = await new Promise<any>((resolve, reject) => {
          socket.timeout(5000).emit(SOCKET_CLIENT_EVENTS.HEARTBEAT, { auctionId, viewerId }, (error: Error | null, result: any) => error ? reject(error) : resolve(result));
        });
        if (response?.success && typeof response.data?.viewerCount === 'number') return response.data;
      } catch { /* One bounded REST fallback, never parallel heartbeat loops. */ }
    }
    return auctionApi.heartbeatViewer(auctionId, viewerId);
  }

  async extendLotTime(playerId: string, seconds: number, requestId = auctionCommandId()): Promise<LotTimeCommandResult> {
    if (!this.auctionId || playerId !== this.currentPlayerId) return { success: false, error: 'The active lot changed. Review the current player.' };
    const auctionId = this.auctionId;
    const generation = this.connectionGeneration;
    try {
      const result = await auctionApi.extendLotTime(auctionId, playerId, seconds, requestId);
      // HTTP is also authoritative. A backed-off snapshot or missing socket
      // frame must not delay a successful extension from reopening bidding.
      if (this.isCurrent(generation, auctionId) && result?.liveState && this.acceptEvent({ auctionId, liveState: result.liveState })) {
        if (this.auction && result.status) this.auction.status = String(result.status).toLowerCase() as Auction['status'];
        this.applyLiveState(result.liveState);
        if (result.timer) this.setTimerBaseline(result.timer.remaining, result.timer.total, result.timer.isRunning);
        this.emit();
      }
      if (this.isCurrent(generation, auctionId)) this.scheduleSnapshot(100, generation);
      return { success: true };
    } catch (error) {
      if (this.isCurrent(generation, auctionId)) this.scheduleSnapshot(100, generation);
      const status = (error as { status?: number })?.status;
      return { success: false, error: error instanceof Error ? error.message : 'Adding time failed',
        uncertain: !status || status === 408 || status >= 500 };
    }
  }

  start() { return this.command(auctionApi.startAuction, 'Start failed'); }
  pause() { return this.command(auctionApi.pauseAuction, 'Pause failed'); }
  resume() { return this.command(auctionApi.resumeAuction, 'Resume failed'); }
  complete() { return this.command(auctionApi.completeAuction, 'Complete failed'); }

  async openNextLot(playerId?: string): Promise<{ success: boolean; error?: string }> {
    const round = runningAuctionRound(this.rounds);
    const eligible = round ? eligibleRoundPlayers(round, this.players) : [];
    const player = playerId ? eligible.find((candidate) => candidate.id === playerId) : eligible[0];
    if (!round || !player) return { success: false, error: 'Select an eligible player from the running round' };
    return this.command((auctionId) => liveAuctionApi.openLot(auctionId, player.id, round.id), 'Open lot failed');
  }

  async undo(actionId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.auctionId) return { success: false, error: 'No active auction' };
    const auctionId = this.auctionId;
    const generation = this.connectionGeneration;
    try {
      const result = await auctionApi.undoAction(auctionId, actionId, reason);
      if (this.isCurrent(generation, auctionId)) {
        if (this.acceptEvent(result)) this.acceptUndo(result);
        await this.refreshSnapshot();
      }
      return { success: true };
    } catch (error: any) {
      if (this.isCurrent(generation, auctionId)) await this.refreshSnapshot();
      return { success: false, error: error.message || 'Undo failed' };
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
    // this.currentBid isn't optimistically updated until the request below
    // resolves, so a rapid double-tap on the bid button (very plausible
    // under auction time pressure) can pass every guard above twice before
    // the first call finishes, sending two requests for the same bid. The
    // server backstops this with rejection, but that costs a round trip and
    // a visible UI flicker. Lock out concurrent calls from this client instead.
    if (this.bidInFlight) {
      return { ok: false, reason: "Bid already in progress" };
    }

    const franchise = this.franchises.find((f) => f.id === teamId);
    if (!franchise) return { ok: false, reason: "Unknown franchise" };

    const player = this.players.find((candidate) => candidate.id === this.currentPlayerId);
    const nextAmount = amount ?? (this.currentBid.teamId
      ? getNextBidAmount(this.currentBid.amount, this.auction.rules.bidIncrements)
      : Math.max(1, player?.basePrice ?? 0));
    const remainingPurse = franchise.purseTotal - franchise.spent;
    if (nextAmount > remainingPurse) return { ok: false, reason: "Insufficient purse remaining" };
    if (franchise.squad.length >= franchise.maxSquadSize) return { ok: false, reason: "Squad is full" };

    if (player?.overseas) {
      const overseasCount = franchise.squad.filter((pid) => this.players.find((p) => p.id === pid)?.overseas).length;
      if (overseasCount >= franchise.maxOverseas) return { ok: false, reason: "Overseas quota reached" };
    }

    const requestId = Symbol('bid');
    this.bidInFlight = requestId;
    const auctionId = this.auctionId;
    const generation = this.connectionGeneration;
    try {
      const createdBid = await bidApi.placeBid(auctionId, { amount: nextAmount, teamId });
      if (this.isCurrent(generation, auctionId)) {
        // An organizer may already have undone this bid while its response
        // was in flight. Never re-apply it optimistically from that response.
        await this.refreshSnapshot();
        this.bidHistory = this.bidHistory.map((bid) => bid.id === createdBid.id ? { ...bid, isUser } : bid);
        this.emit();
      }
      return { ok: true };
    } catch (error: any) {
      return { ok: false, reason: error.message || 'Bid rejected' };
    } finally {
      if (this.bidInFlight === requestId) this.bidInFlight = null;
    }
  }


  private lotTarget(target?: LotDecisionTarget): LotDecisionTarget | null {
    if (!this.currentPlayerId || !this.currentRoundId) return null;
    if (target && (target.tournamentPlayerId !== this.currentPlayerId || target.roundId !== this.currentRoundId || target.expectedVersion !== this.lastVersion)) return null;
    return target ?? { tournamentPlayerId: this.currentPlayerId, roundId: this.currentRoundId, expectedVersion: this.lastVersion };
  }

  forceSold(reviewed?: LotDecisionTarget): Promise<{ success: boolean; error?: string }> {
    const target = this.lotTarget(reviewed);
    if (!target || !this.currentBid.teamId) return Promise.resolve({ success: false, error: 'The reviewed lot changed or has no winning bid. Review it again.' });
    return this.command((auctionId) => liveAuctionApi.markSold(auctionId, target), 'Force sold failed');
  }

  forceUnsold(reviewed?: LotDecisionTarget): Promise<{ success: boolean; error?: string }> {
    const target = this.lotTarget(reviewed);
    if (!target) return Promise.resolve({ success: false, error: 'The reviewed player or pass changed. Review the current lot again.' });
    return this.command((auctionId) => liveAuctionApi.markUnsold(auctionId, target), 'Force unsold failed');
  }

  markPermanentUnsold(tournamentPlayerId: string, reviewed?: LotDecisionTarget): Promise<{ success: boolean; error?: string }> {
    const player = this.players.find((candidate) => candidate.id === tournamentPlayerId);
    const roundId = player?.auctionRoundId ?? this.currentRoundId;
    const target = reviewed ?? (roundId ? { tournamentPlayerId, roundId, expectedVersion: this.lastVersion } : null);
    if (!target || target.tournamentPlayerId !== tournamentPlayerId || target.roundId !== roundId || target.expectedVersion !== this.lastVersion) {
      return Promise.resolve({ success: false, error: 'The reviewed player or pass changed. Review the current lot again.' });
    }
    return this.command((auctionId) => liveAuctionApi.markPermanentUnsold(auctionId, tournamentPlayerId,
      { roundId: target.roundId, expectedVersion: target.expectedVersion }), 'Failed to retire player');
  }

  advanceUnsoldPass(roundId: string): Promise<{ success: boolean; error?: string }> {
    const expectedVersion = this.lastVersion;
    return this.command((auctionId) => liveAuctionApi.advanceUnsoldPass(auctionId, roundId, expectedVersion), 'Could not continue this unsold pass');
  }

}

/**
 * Socket.IO treats any path in the connection URL as a *namespace*, not an
 * HTTP path. The only correct connection target is the origin — the actual
 * transport path is pinned via the `path` option in setupSocket().
 */
function resolveSocketOrigin(url: string): string {
  try {
    return new URL(url, typeof window === "undefined" ? undefined : window.location.origin).origin;
  } catch {
    return url;
  }
}
