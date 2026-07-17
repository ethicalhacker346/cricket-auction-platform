// src/hooks/useFranchise.ts
import { useCallback } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { franchiseApi } from "@/api/franchiseApi";
import { getErrorMessage } from "@/lib/utils/errorMessage";
import type {
  FranchisePayload,
  FranchiseListQuery,
  Franchise,
  FranchiseListResult,
} from "@/api/franchiseApi";

// ═══════════════════════════════════════════════════════════════════════════════
// Query Key Factory
// ═══════════════════════════════════════════════════════════════════════════════

export const franchiseKeys = {
  all: ["franchises"] as const,
  lists: () => [...franchiseKeys.all, "list"] as const,
  list: (filters: FranchiseListQuery) => [...franchiseKeys.lists(), filters] as const,
  mine: () => [...franchiseKeys.all, "mine"] as const,
  mineList: (filters: FranchiseListQuery) => [...franchiseKeys.mine(), filters] as const,
  detail: (id: string) => [...franchiseKeys.all, "detail", id] as const,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Backend returns MongoDB documents with _id (ObjectId).
 * Frontend expects id (string) for React keys and routing.
 * This helper normalizes the shape.
 */
function normalizeFranchise(doc: any): Franchise {
  return {
    id: doc._id?.toString?.() ?? doc.id ?? doc._id,
    _id: doc._id?.toString?.() ?? doc.id ?? doc._id,
    ownerId: doc.ownerId?.toString?.() ?? doc.ownerId,
    name: doc.name,
    slug: doc.slug,
    city: doc.city,
    description: doc.description,
    logo: doc.logo,
    primaryColor: doc.primaryColor,
    secondaryColor: doc.secondaryColor,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function normalizeFranchiseListResult(result: FranchiseListResult) {
    return {
        data: result.data.map(normalizeFranchise),
        pagination: result.pagination,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/** Fetches the current user's owned franchises (for dashboard / selector). */
export function useMyFranchises(
  params?: FranchiseListQuery,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: franchiseKeys.mineList(params ?? {}),
    queryFn: async () => {
      // FIX: franchiseApi.listMine returns ApiEnvelope { success, data: { data, pagination } }
      // We need to unwrap the envelope and normalize _id → id
      const raw = await franchiseApi.listMine(params);
      return normalizeFranchiseListResult(raw);
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    enabled: options?.enabled !== false,
  });
}

/** Infinite-scrolling variant for owners with many franchises. */
export function useInfiniteMyFranchises(baseParams?: Omit<FranchiseListQuery, "page">) {
  return useInfiniteQuery({
    queryKey: [...franchiseKeys.mine(), "infinite", baseParams ?? {}],
    queryFn: async ({ pageParam = 1 }) => {
      const raw = await franchiseApi.listMine({ ...baseParams, page: pageParam });
      return normalizeFranchiseListResult(raw);
    },
    getNextPageParam: (lastPage: FranchiseListResult) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
  });
}

/** Public franchise detail — used for public pages and edit forms. */
export function useFranchiseById(id: string) {
  return useQuery({
    queryKey: franchiseKeys.detail(id),
    queryFn: async () => {
      const raw = await franchiseApi.getById(id);
      // Unwrap envelope if present
      const doc = raw?.data ?? raw;
      return normalizeFranchise(doc);
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useCreateFranchise() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FranchisePayload) => {
      const raw = await franchiseApi.create(payload);
      // Unwrap envelope
      return normalizeFranchise(raw?.data ?? raw);
    },
    onSuccess: (data) => {
      // Prime cache so the edit view mounts instantly
      queryClient.setQueryData(franchiseKeys.detail(data.id), data);
      // Invalidate owner's franchise list
      queryClient.invalidateQueries({ queryKey: franchiseKeys.mine() });
      toast.success(`Franchise "${data.name}" created successfully!`);

      navigate(`/franchises/${data.id}/edit`, { replace: true });
    },
    onError: (error) => {
      const msg = getErrorMessage(error);
      if (msg.toLowerCase().includes("409") || msg.toLowerCase().includes("slug")) {
        toast.error("That slug is already taken. Try a different one.");
      } else {
        toast.error(msg);
      }
    },
  });
}

export function useUpdateFranchise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<FranchisePayload> }) => {
      const raw = await franchiseApi.update(id, payload);
      return normalizeFranchise(raw?.data ?? raw);
    },

    // ─── Optimistic Phase ───
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: franchiseKeys.detail(id) });
      const previous = queryClient.getQueryData<Franchise>(franchiseKeys.detail(id));

      if (previous) {
        queryClient.setQueryData<Franchise>(franchiseKeys.detail(id), {
          ...previous,
          ...payload,
          updatedAt: new Date().toISOString(),
        });
      }

      // Also optimistically update the mine list if cached
      const mineKey = franchiseKeys.mineList({});
      const mineData = queryClient.getQueryData<FranchiseListResult>(mineKey);
      if (mineData) {
        queryClient.setQueryData(mineKey, {
          ...mineData,
          data: mineData.data.map((f) =>
            f.id === id ? { ...f, ...payload, updatedAt: new Date().toISOString() } : f
          ),
        });
      }

      return { previous, id };
    },

    // ─── Rollback Phase ───
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(franchiseKeys.detail(context.id), context.previous);
      }
      toast.error(getErrorMessage(error));
    },

    // ─── Settlement Phase ───
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: franchiseKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: franchiseKeys.mine() });
    },

    onSuccess: () => {
      toast.success("Franchise updated successfully!");
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function usePrefetchFranchise() {
  const queryClient = useQueryClient();

  return useCallback(
    (id: string) => {
      queryClient.prefetchQuery({
        queryKey: franchiseKeys.detail(id),
        queryFn: async () => {
          const raw = await franchiseApi.getById(id);
          return normalizeFranchise(raw?.data ?? raw);
        },
        staleTime: 10 * 60 * 1000,
      });
    },
    [queryClient]
  );
}