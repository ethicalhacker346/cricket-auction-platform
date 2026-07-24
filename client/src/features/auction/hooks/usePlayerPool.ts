import { useCallback, useEffect, useMemo, useState } from "react";
import { playerApi, auctionRoundApi } from "@/features/auction/api/index.api";
import type { Player, AuctionRound } from "@/features/auction/types/index.types";
import { getApiErrorMessage } from "@/features/auction/utils/index.utils";

export type PlayerRole = "batsman" | "bowler" | "allrounder" | "wicketkeeper";

export const ROLE_OPTIONS: { value: PlayerRole; label: string; color: string }[] = [
  { value: "batsman", label: "Batsman", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  { value: "bowler", label: "Bowler", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  { value: "allrounder", label: "All-Rounder", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { value: "wicketkeeper", label: "Wicket-Keeper", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
];

export interface UsePlayerPoolOptions {
  tournamentId?: string;
  auctionId?: string;
  rounds: AuctionRound[];
  onRoundsChange?: () => void;
}

export interface UsePlayerPoolReturn {
  // Data
  players: Player[];
  loading: boolean;
  error: string | null;

  // Filtering
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  roleFilter: PlayerRole[];
  toggleRole: (role: PlayerRole) => void;
  clearFilters: () => void;

  // Selection (persistent across filters)
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;

  // Assignment
  assigning: boolean;
  assignError: string | null;
  assignToRound: (roundId: string) => Promise<void>;
  removeFromRound: (roundId: string) => Promise<void>;

  // Derived
  filteredPlayers: Player[];
  selectedPlayers: Player[];
  playerRoundMap: Map<string, string>; // playerId -> roundId
}

export function usePlayerPool({
  tournamentId,
  auctionId,
  rounds,
  onRoundsChange,
}: UsePlayerPoolOptions): UsePlayerPoolReturn {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<PlayerRole[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Fetch players
  const refresh = useCallback(() => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    playerApi
      .listPlayers(tournamentId)
      .then((list) => {
        setPlayers(list);
        setError(null);
      })
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [tournamentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Build player -> round mapping for quick lookup
  const playerRoundMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const round of rounds) {
      for (const pid of round.playerIds) {
        map.set(pid, round.id);
      }
    }
    return map;
  }, [rounds]);

  // Filtered players
  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      const matchesRole = roleFilter.length === 0 || roleFilter.includes(p.role as PlayerRole);
      const matchesSearch =
        searchQuery.trim() === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.country.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRole && matchesSearch;
    });
  }, [players, roleFilter, searchQuery]);

  // Selected player objects
  const selectedPlayers = useMemo(
    () => players.filter((p) => selectedIds.has(p.id)),
    [players, selectedIds]
  );

  // Selection helpers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const p of filteredPlayers) {
        next.add(p.id);
      }
      return next;
    });
  }, [filteredPlayers]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggleRole = useCallback((role: PlayerRole) => {
    setRoleFilter((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setRoleFilter([]);
  }, []);

  // ── Assign selected players to a round ──────────────────────────────────
  const assignToRound = useCallback(
    async (roundId: string) => {
      if (!auctionId || selectedIds.size === 0) return;
      const targetRound = rounds.find((r) => r.id === roundId);
      if (!targetRound) return;

      setAssigning(true);
      setAssignError(null);

      try {
        // Merge: existing round players + newly selected (deduped)
        const newPlayerIds = [...new Set([...targetRound.playerIds, ...selectedIds])];
        await auctionRoundApi.updateRound(auctionId, roundId, { playerIds: newPlayerIds });

        // Optimistic: update local rounds state if callback provided
        onRoundsChange?.();
        clearSelection();
      } catch (e: any) {
        setAssignError(e.message || "Failed to assign players");
        throw e;
      } finally {
        setAssigning(false);
      }
    },
    [auctionId, selectedIds, rounds, onRoundsChange, clearSelection]
  );

  // ── Remove selected players from a round ────────────────────────────────
  const removeFromRound = useCallback(
    async (roundId: string) => {
      if (!auctionId || selectedIds.size === 0) return;
      const targetRound = rounds.find((r) => r.id === roundId);
      if (!targetRound) return;

      setAssigning(true);
      setAssignError(null);

      try {
        const toRemove = new Set(selectedIds);
        const newPlayerIds = targetRound.playerIds.filter((id) => !toRemove.has(id));
        await auctionRoundApi.updateRound(auctionId, roundId, { playerIds: newPlayerIds });

        onRoundsChange?.();
        clearSelection();
      } catch (e: any) {
        setAssignError(e.message || "Failed to remove players");
        throw e;
      } finally {
        setAssigning(false);
      }
    },
    [auctionId, selectedIds, rounds, onRoundsChange, clearSelection]
  );

  return {
    players,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    roleFilter,
    toggleRole,
    clearFilters,
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    assigning,
    assignError,
    assignToRound,
    removeFromRound,
    filteredPlayers,
    selectedPlayers,
    playerRoundMap,
  };
}