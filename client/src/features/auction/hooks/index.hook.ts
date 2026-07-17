import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auctionApi, auctionRoundApi, franchiseApi } from "@/features/auction/api/index.api";
import type { AuctionSavePayload } from "@/features/auction/api/index.api";
import { API_BASE_URL } from "@/features/auction/constants/index.constants";
import { getAuctionEngine, useBidUiStore, useLiveAuctionStore, useRoleStore } from "@/features/auction/store/index.store";
import { useAuthStore } from "@/store/authStore";
import type { User } from "@/types/auth";
import type { Auction, AuctionRound, Franchise } from "@/features/auction/types/index.types";
import { computePermissions, formatSeconds, getNextBidAmount } from "@/features/auction/utils/index.utils";
import { USER_ROLES } from "@/lib/constants/roles";

// ============================================================================
// useAuth — convenience re-export with auction-relevant selectors
// ============================================================================
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  return { user, isAuthenticated, hasHydrated, accessToken };
}

// ============================================================================
// useAuctionSocket — bootstraps the live connection via Socket.IO.
//
// AuctionEngine now opens a Socket.IO connection to the backend, joins the
// auction room, and listens for real-time domain events. It falls back to
// REST polling (GET /auctions/:id/snapshot) every 10s if the socket fails.
// The local countdown timer is still interpolated between server updates.
// ============================================================================
export function useAuctionSocket(auctionId?: string, tournamentId?: string) {
  const bootstrap = useLiveAuctionStore((s) => s.bootstrap);
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);
  const connection = useLiveAuctionStore((s) => s.connection);
  const latency = useLiveAuctionStore((s) => s.serverLatencyMs);

  const effectiveAuctionId = auctionId || storeAuctionId;
  const effectiveTournamentId = tournamentId || storeTournamentId;

  useEffect(() => {
    if (effectiveAuctionId && effectiveTournamentId) {
      bootstrap(effectiveAuctionId, effectiveTournamentId);
    }
  }, [bootstrap, effectiveAuctionId, effectiveTournamentId]);

  return { connection, latencyMs: latency, isConnected: connection === "connected" };
}

// ============================================================================
// useLiveAuction
// ============================================================================
export function useLiveAuction(auctionId?: string, tournamentId?: string) {
  useAuctionSocket(auctionId, tournamentId);
  const snapshot = useLiveAuctionStore();

  const currentPlayer = useMemo(
    () => snapshot.players.find((p) => p.id === snapshot.currentPlayerId) ?? null,
    [snapshot.players, snapshot.currentPlayerId]
  );
  const currentRound = useMemo(
    () => snapshot.rounds.find((r) => r.id === snapshot.currentRoundId) ?? null,
    [snapshot.rounds, snapshot.currentRoundId]
  );
  const leadingFranchise = useMemo(
    () => snapshot.franchises.find((f) => f.id === snapshot.currentBid.teamId) ?? null,
    [snapshot.franchises, snapshot.currentBid.teamId]
  );
  const upcomingPlayers = useMemo(() => {
    const orderedRounds = [...snapshot.rounds].sort((a, b) => a.order - b.order);
    const flat = orderedRounds.flatMap((r) => r.playerIds);
    const idx = snapshot.currentPlayerId ? flat.indexOf(snapshot.currentPlayerId) : -1;
    const upcomingIds = idx >= 0 ? flat.slice(idx + 1) : flat.filter((id) => {
      const p = snapshot.players.find((pl) => pl.id === id);
      return p?.status === "pending";
    });
    return upcomingIds
      .map((id) => snapshot.players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p && p.status === "pending")
      .slice(0, 8);
  }, [snapshot.rounds, snapshot.players, snapshot.currentPlayerId]);

  const nextBidAmount = getNextBidAmount(
    snapshot.currentBid.amount,
    snapshot.auction?.rules?.bidIncrements || []
  );

  return {
    ...snapshot,
    currentPlayer,
    currentRound,
    leadingFranchise,
    upcomingPlayers,
    nextBidAmount,
    actions: snapshot.actions,
  };
}

// ============================================================================
// useAuctionTimer
// ============================================================================
export function useAuctionTimer(auctionId?: string, tournamentId?: string) {
  useAuctionSocket(auctionId, tournamentId);
  const timer = useLiveAuctionStore((s) => s.timer);
  const progress = timer.total > 0 ? timer.remaining / timer.total : 0;
  return {
    ...timer,
    formatted: formatSeconds(timer.remaining),
    progress,
    isCritical: timer.remaining <= 5 && timer.remaining > 0,
    isExpired: timer.remaining === 0,
  };
}

// ============================================================================
// useAuctionPermissions — real auth + role override
// ============================================================================
export function useAuctionPermissions() {
    const {
        user,
        isAuthenticated,
        hasHydrated,
    } = useAuth();

    const status = useLiveAuctionStore(s => s.status);
    const currentPlayerId = useLiveAuctionStore(
        s => s.currentPlayerId
    );

    if (!hasHydrated) {
        return {
            loading: true
        };
    }

    if (!isAuthenticated || !user) {
        return {
            loading: false,
            authenticated: false,
            ...emptyPermissions
        };
    }

    const role = user.role;

    const isOrganizer =
        role === USER_ROLES.ORGANIZER ||
        role === USER_ROLES.ADMIN;

    return {
        loading: false,
        authenticated: true,
        ...computePermissions(
            status,
            !!currentPlayerId,
            isOrganizer
        )
    };
}

// ============================================================================
// useBid — async against real backend
// ============================================================================
export function useBid(teamId: string, _auctionId?: string) {
  const placeBidAction = useLiveAuctionStore((s) => s.actions.placeBid);
  const nextBidAmount = useLiveAuctionStore((s) =>
    getNextBidAmount(s.currentBid.amount, s.auction?.rules?.bidIncrements || [])
  );
  const { isPlacing, lastError, flashSeq } = useBidUiStore();
  const setPlacing = useBidUiStore((s) => s.setPlacing);
  const setError = useBidUiStore((s) => s.setError);
  const flash = useBidUiStore((s) => s.flash);

  const placeBid = useCallback(
    async (amount?: number) => {
      setPlacing(true);
      setError(null);
      try {
        const result = await placeBidAction(teamId, amount, true);
        setPlacing(false);
        if (!result.ok) {
          setError(result.reason ?? "Could not place bid");
        } else {
          flash();
        }
      } catch (e: any) {
        setPlacing(false);
        setError(e.message || "Network error");
      }
    },
    [teamId, placeBidAction, setPlacing, setError, flash]
  );

  return { placeBid, isPlacing, lastError, flashSeq, nextBidAmount };
}

// ============================================================================
// useBidHistory
// ============================================================================
export function useBidHistory(playerId?: string, limit = 40) {
  const bidHistory = useLiveAuctionStore((s) => s.bidHistory);
  const franchises = useLiveAuctionStore((s) => s.franchises);
  const players = useLiveAuctionStore((s) => s.players);

  const filtered = useMemo(() => {
    const list = playerId ? bidHistory.filter((b) => b.playerId === playerId) : bidHistory;
    return list.slice(0, limit).map((bid) => ({
      ...bid,
      franchise: franchises.find((f) => f.id === bid.teamId) ?? null,
      player: players.find((p) => p.id === bid.playerId) ?? null,
    }));
  }, [bidHistory, franchises, players, playerId, limit]);

  return filtered;
}

// ============================================================================
// useAuctionLogs
// ============================================================================
export function useAuctionLogs(limit = 30) {
  const logs = useLiveAuctionStore((s) => s.logs);
  return logs.slice(0, limit);
}

// ============================================================================
// useAuction — CRUD/config hook (pre-live)
// ============================================================================
export function useAuction(tournamentId?: string) {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  const refresh = useCallback(() => {
    if (!tournamentId) {
      setLoading(false);
      setError("No tournament ID provided");
      return;
    }
    setLoading(true);
    auctionApi
      .getAuction(tournamentId)
      .then(setAuction)
      .catch((e) => setError(e.message || "Failed to load auction"))
      .finally(() => setLoading(false));
  }, [tournamentId]);

  useEffect(() => {
    if (isAuthenticated && tournamentId) {
      refresh();
    }
  }, [refresh, isAuthenticated, tournamentId]);

  const actions = useMemo(
    () => ({
      create: async (payload: AuctionSavePayload) => {
        if (!tournamentId) throw new Error("No tournament ID");
        const created = await auctionApi.createAuction(tournamentId, payload);
        setAuction(created);
        return created;
      },
      updateRules: async (payload: AuctionSavePayload) => {
        if (!auction?.id) throw new Error("No auction loaded");
        const updated = await auctionApi.updateRules(auction.id, payload);
        setAuction(updated);
        return updated;
      },
      save: async (payload: AuctionSavePayload) => {
        if (auction?.id) {
          const updated = await auctionApi.updateRules(auction.id, payload);
          setAuction(updated);
          return updated;
        }
        if (!tournamentId) throw new Error("No tournament ID");
        const created = await auctionApi.createAuction(tournamentId, payload);
        setAuction(created);
        return created;
      },
      start: async () => {
        if (!auction?.id) throw new Error("No auction loaded");
        const updated = await auctionApi.startAuction(auction.id);
        setAuction(updated);
      },
      pause: async () => {
        if (!auction?.id) throw new Error("No auction loaded");
        const updated = await auctionApi.pauseAuction(auction.id);
        setAuction(updated);
      },
      resume: async () => {
        if (!auction?.id) throw new Error("No auction loaded");
        const updated = await auctionApi.resumeAuction(auction.id);
        setAuction(updated);
      },
      complete: async () => {
        if (!auction?.id) throw new Error("No auction loaded");
        const updated = await auctionApi.completeAuction(auction.id);
        setAuction(updated);
      },
    }),
    [auction, tournamentId]
  );

  return { auction, loading, error, refresh, actions };
}

// ============================================================================
// useAuctionRounds
// ============================================================================
export function useAuctionRounds(auctionId?: string) {
  const [rounds, setRounds] = useState<AuctionRound[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!auctionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    auctionRoundApi
      .listRounds(auctionId)
      .then((r) => {
        setRounds(r.sort((a, b) => a.order - b.order));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [auctionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const actions = useMemo(
    () => ({
      add: async (round: Omit<AuctionRound, "id" | "auctionId">) => {
        if (!auctionId) throw new Error("No auction ID");
        await auctionRoundApi.addRound(auctionId, round);
        refresh();
      },
      update: async (id: string, patch: Partial<AuctionRound>) => {
        if (!auctionId) throw new Error("No auction ID");
        await auctionRoundApi.updateRound(auctionId, id, patch);
        refresh();
      },
      remove: async (id: string) => {
        if (!auctionId) throw new Error("No auction ID");
        await auctionRoundApi.deleteRound(auctionId, id);
        refresh();
      },
    }),
    [auctionId, refresh]
  );

  return { rounds, loading, refresh, actions };
}

// ============================================================================
// useAuctionViewerPresence — live "N watching" counter
// ============================================================================
// Heartbeats this client's presence via REST on an interval well under the
// backend's VIEWER_HEARTBEAT_TTL_SECONDS (45s). The returned count is now
// superseded in real-time by viewerCount from useLiveAuctionStore, which is
// pushed via Socket.IO (SOCKET_EVENTS.VIEWER_COUNT_UPDATED). This hook still
// serves the critical job of REGISTERING presence so the backend knows this
// client is alive.
// ============================================================================
const VIEWER_HEARTBEAT_INTERVAL_MS = 15_000;
const VIEWER_ID_STORAGE_KEY = "auction_viewer_id";

function getAnonymousViewerId(): string {
  const existing = sessionStorage.getItem(VIEWER_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(VIEWER_ID_STORAGE_KEY, generated);
  return generated;
}

export function useAuctionViewerPresence(auctionId?: string) {
  const { user } = useAuth();
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const viewerIdRef = useRef<string>();
  if (!viewerIdRef.current) {
    viewerIdRef.current = user?.id ? `user:${user.id}` : `anon:${getAnonymousViewerId()}`;
  }

  useEffect(() => {
    if (!auctionId) return;
    const viewerId = viewerIdRef.current as string;
    let cancelled = false;

    const beat = () => {
      auctionApi
        .heartbeatViewer(auctionId, viewerId)
        .then(({ viewerCount: count }) => {
          if (!cancelled) setViewerCount(count);
        })
        .catch(() => {
          // A missed heartbeat isn't fatal: the next interval tick retries,
          // and the backend TTL means a genuinely dead client ages out on
          // its own regardless of whether this call ever lands.
        });
    };

    beat();
    const interval = setInterval(beat, VIEWER_HEARTBEAT_INTERVAL_MS);

    const leaveBeacon = () => {
      navigator.sendBeacon?.(
        `${API_BASE_URL}/auctions/${auctionId}/viewers/leave`,
        new Blob([JSON.stringify({ viewerId })], { type: "application/json" })
      );
    };
    window.addEventListener("beforeunload", leaveBeacon);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("beforeunload", leaveBeacon);
      leaveBeacon();
    };
  }, [auctionId]);

  return viewerCount;
}

// ============================================================================
// useFranchises
// ============================================================================
export function useFranchises(tournamentId?: string) {
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }
    franchiseApi
      .listFranchises(tournamentId)
      .then((f) => {
        setFranchises(f);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tournamentId]);

  return { franchises, loading };
}

// ============================================================================
// useUserTeam — resolves the authenticated user's franchise
// ============================================================================
export function useUserTeam(franchises: Franchise[]) {
  const { user } = useAuth();
  const userTeamId = useRoleStore((s) => s.userTeamId);

  return useMemo(() => {
    const targetId = user?.teamId || userTeamId;
    return franchises.find((f) => f.id === targetId) ?? null;
  }, [franchises, user, userTeamId]);
}