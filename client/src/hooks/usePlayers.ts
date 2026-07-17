// src/hooks/usePlayer.ts
import { useCallback, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { playerApi } from "@/api/playerApi";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/lib/utils/errorMessage";
import type {
  PlayerPayload,
  PlayerListQuery,
  Player,
  PlayerListResult,
} from "@/api/playerApi";

// ═══════════════════════════════════════════════════════════════════════════════
// Query Key Factory — centralized, type-safe cache identity
// Prevents cache-key typos and makes invalidation surgical.
// ═══════════════════════════════════════════════════════════════════════════════

export const playerKeys = {
  all: ["players"] as const,
  lists: () => [...playerKeys.all, "list"] as const,
  list: (filters: PlayerListQuery) => [...playerKeys.lists(), filters] as const,
  me: () => [...playerKeys.all, "me"] as const,
  detail: (id: string) => [...playerKeys.all, "detail", id] as const,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetches the current authenticated user's player profile.
 * Mirrors useCurrentUser but with stronger cache semantics and window-focus refetch.
 */
export function usePlayerMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: playerKeys.me(),
    queryFn: () => playerApi.me(),
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,      // 5 min — profile data is semi-static
    refetchOnWindowFocus: true,      // Better than useAuth: keep fresh on return
  });
}

/**
 * Fetches a public player profile by ID.
 * Long stale-time because Player schema profiles change infrequently.
 */
export function usePlayerById(id: string) {
  return useQuery({
    queryKey: playerKeys.detail(id),
    queryFn: () => playerApi.getById(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,     // 10 min
    gcTime: 15 * 60 * 1000,        // Keep in garbage-collector 15 min
  });
}

/**
 * Standard paginated list. Use for grids with manual pagination controls.
 * placeholderData keeps the previous page visible while the next loads —
 * no jarring white flash.
 */
export function usePlayerList(params?: PlayerListQuery) {
  return useQuery({
    queryKey: playerKeys.list(params ?? {}),
    queryFn: () => playerApi.list(params),
    staleTime: 2 * 60 * 1000,      // 2 min — browse data shifts more often
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Infinite-scrolling / load-more list. Superior UX for browse screens.
 * Automatically accumulates pages and detects the next-page boundary from
 * the backend pagination envelope.
 */
export function useInfinitePlayerList(
  baseParams?: Omit<PlayerListQuery, "page">
) {
  return useInfiniteQuery({
    queryKey: [...playerKeys.lists(), "infinite", baseParams ?? {}],
    queryFn: async ({ pageParam = 1 }) => {
      const result = await playerApi.list({ ...baseParams, page: pageParam });
      return result;
    },
    getNextPageParam: (lastPage: PlayerListResult) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates a player profile for the authenticated user.
 * Primes the "me" cache immediately so the profile screen renders
 * instantly on redirect without a loading flash.
 */
export function useCreatePlayer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PlayerPayload) => playerApi.create(payload),
    onSuccess: (data) => {
      // Prime the cache so /players/me mounts instantly
      queryClient.setQueryData(playerKeys.me(), data);

      // Invalidate browse lists so the new player appears in public grids
      queryClient.invalidateQueries({ queryKey: playerKeys.lists() });

      toast.success("Player profile created successfully!");
      navigate("/players/me", { replace: true });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Updates the current user's player profile.
 *
 * ROCK-STAR FEATURE: Full optimistic update with automatic rollback.
 * The UI patches instantly. If the server rejects, we snap back to the
 * previous state without the user ever seeing a broken intermediate screen.
 */
export function useUpdatePlayerMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<PlayerPayload>) => playerApi.updateMe(payload),

    // ─── Optimistic Phase ───
    onMutate: async (newData) => {
      // Cancel in-flight refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: playerKeys.me() });

      // Snapshot current cache for rollback
      const previousPlayer = queryClient.getQueryData<Player>(playerKeys.me());

      // Optimistically patch the cache
      if (previousPlayer) {
        queryClient.setQueryData<Player>(playerKeys.me(), {
          ...previousPlayer,
          ...newData,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousPlayer };
    },

    // ─── Rollback Phase ───
    onError: (error, _variables, context) => {
      if (context?.previousPlayer) {
        queryClient.setQueryData(playerKeys.me(), context.previousPlayer);
      }
      toast.error(getErrorMessage(error));
    },

    // ─── Settlement Phase ───
    onSettled: (_data, _error, variables) => {
      // Always reconcile with server truth
      queryClient.invalidateQueries({ queryKey: playerKeys.me() });

      // If public-visible fields changed, invalidate public lists too
      const publicFields: (keyof PlayerPayload)[] = [
        "fullName",
        "primaryRole",
        "battingStyle",
        "bowlingStyle",
        "profileImage",
        "nationality",
        "bio",
      ];
      const touchedPublic = publicFields.some((f) => f in variables);
      if (touchedPublic) {
        queryClient.invalidateQueries({ queryKey: playerKeys.lists() });
      }
    },

    onSuccess: () => {
      toast.success("Profile updated successfully!");
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns a prefetch function for hover/click-before-mount scenarios.
 * Use inside player cards: onMouseEnter={() => prefetchPlayer(id)}
 */
export function usePrefetchPlayer() {
  const queryClient = useQueryClient();

  return useCallback(
    (id: string) => {
      queryClient.prefetchQuery({
        queryKey: playerKeys.detail(id),
        queryFn: () => playerApi.getById(id),
        staleTime: 10 * 60 * 1000,
      });
    },
    [queryClient]
  );
}

/**
 * Combined filter-state + query hook for browse screens.
 * Manages filters locally and returns the bound query result.
 * Resets page to 1 whenever any filter changes.
 */
export function usePlayerBrowse(initialFilters?: PlayerListQuery) {
  const [filters, setFilters] = useState<PlayerListQuery>(initialFilters ?? {});

  const query = usePlayerList(filters);

  const updateFilter = useCallback(
    <K extends keyof PlayerListQuery>(key: K, value: PlayerListQuery[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(initialFilters ?? {});
  }, [initialFilters]);

  return {
    filters,
    updateFilter,
    resetFilters,
    ...query,
  };
}

// Simple debounce helper for usePlayerBrowse (if you want to add it)
// import { useState, useEffect } from "react";
// function useDebounce<T>(value: T, delay: number): T { ... }