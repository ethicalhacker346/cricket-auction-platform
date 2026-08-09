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
  PlayerImageUploadResult,   // ← NEW
} from "@/api/playerApi";

// ═══════════════════════════════════════════════════════════════════════════════
// Query Key Factory
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

export function usePlayerMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: playerKeys.me(),
    queryFn: () => playerApi.me(),
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function usePlayerById(id: string) {
  return useQuery({
    queryKey: playerKeys.detail(id),
    queryFn: () => playerApi.getById(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function usePlayerList(params?: PlayerListQuery) {
  return useQuery({
    queryKey: playerKeys.list(params ?? {}),
    queryFn: () => playerApi.list(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

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

export function useCreatePlayer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PlayerPayload) => playerApi.create(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(playerKeys.me(), data);
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
 * LIBRARY PATH: Update profile fields including selecting a pre-made image URL.
 * Fully optimistic — UI updates instantly, rolls back on error.
 */
export function useUpdatePlayerMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<PlayerPayload>) => playerApi.updateMe(payload),

    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: playerKeys.me() });
      const previousPlayer = queryClient.getQueryData<Player>(playerKeys.me());

      if (previousPlayer) {
        queryClient.setQueryData<Player>(playerKeys.me(), {
          ...previousPlayer,
          ...newData,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousPlayer };
    },

    onError: (error, _variables, context) => {
      if (context?.previousPlayer) {
        queryClient.setQueryData(playerKeys.me(), context.previousPlayer);
      }
      toast.error(getErrorMessage(error));
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: playerKeys.me() });

      const publicFields: (keyof PlayerPayload)[] = [
        "fullName", "primaryRole", "battingStyle",
        "bowlingStyle", "profileImage", "nationality", "bio",
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

// ─── NEW: CUSTOM UPLOAD PATH ────────────────────────────────────────────────
/**
 * CUSTOM PATH: Upload a user-selected image file.
 * Not optimistic (we don't know the Cloudinary URL until server responds),
 * but patches the cache instantly on success so the UI feels snappy.
 */
export function useUploadPlayerProfileImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => playerApi.uploadProfileImage(file),
    onSuccess: (data) => {
      // Instant cache patch — no refetch flash
      queryClient.setQueryData<Player>(playerKeys.me(), (old) => {
        if (!old) return old;
        return {
          ...old,
          profileImage: data.profileImage,
          updatedAt: new Date().toISOString(),
        };
      });

      // profileImage is public-visible — invalidate browse grids
      queryClient.invalidateQueries({ queryKey: playerKeys.lists() });
      toast.success("Profile image uploaded!");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Remove profile image. Clears DB field + deletes Cloudinary asset.
 */
export function useRemovePlayerProfileImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => playerApi.removeProfileImage(),
    onSuccess: (player) => {
      // Replace cache with server-truth (player doc with profileImage: undefined)
      queryClient.setQueryData<Player>(playerKeys.me(), player);
      queryClient.invalidateQueries({ queryKey: playerKeys.lists() });
      toast.success("Profile image removed");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

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