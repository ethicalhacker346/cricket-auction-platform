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
  FranchiseImageUploadResult,  // ← NEW
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
    colorFrom: doc.colorFrom ?? null,
    colorTo: doc.colorTo ?? null,
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

export function useMyFranchises(
  params?: FranchiseListQuery,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: franchiseKeys.mineList(params ?? {}),
    queryFn: async () => {
      const raw = await franchiseApi.listMine(params);
      return normalizeFranchiseListResult(raw);
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    enabled: options?.enabled !== false,
  });
}

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

export function useFranchiseById(id: string) {
  return useQuery({
    queryKey: franchiseKeys.detail(id),
    queryFn: async () => {
      const raw = await franchiseApi.getById(id);
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
      return normalizeFranchise(raw?.data ?? raw);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(franchiseKeys.detail(data.id), data);
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

/**
 * LIBRARY PATH: Update franchise fields including selecting a pre-made logo URL.
 * Fully optimistic with automatic rollback.
 */
export function useUpdateFranchise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<FranchisePayload> }) => {
      const raw = await franchiseApi.update(id, payload);
      return normalizeFranchise(raw?.data ?? raw);
    },

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

    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(franchiseKeys.detail(context.id), context.previous);
      }
      toast.error(getErrorMessage(error));
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: franchiseKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: franchiseKeys.mine() });
    },

    onSuccess: () => {
      toast.success("Franchise updated successfully!");
    },
  });
}

// ─── NEW: CUSTOM UPLOAD PATH ────────────────────────────────────────────────
/**
 * CUSTOM PATH: Upload a user-selected logo file for a franchise.
 * Patches detail + mine-list caches instantly on success.
 */
export function useUploadFranchiseLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      franchiseApi.uploadLogo(id, file),

    onSuccess: (data, variables) => {
      // Patch detail cache instantly
      queryClient.setQueryData<Franchise>(franchiseKeys.detail(variables.id), (old) => {
        if (!old) return old;
        return { ...old, logo: data.logo, updatedAt: new Date().toISOString() };
      });

      // Patch mine list if cached
      const mineKey = franchiseKeys.mineList({});
      const mineData = queryClient.getQueryData<FranchiseListResult>(mineKey);
      if (mineData) {
        queryClient.setQueryData(mineKey, {
          ...mineData,
          data: mineData.data.map((f) =>
            f.id === variables.id
              ? { ...f, logo: data.logo, updatedAt: new Date().toISOString() }
              : f
          ),
        });
      }

      toast.success("Logo uploaded successfully!");
    },

    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Remove franchise logo. Clears DB field + deletes Cloudinary asset.
 */
export function useRemoveFranchiseLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => franchiseApi.removeLogo(id),

    onSuccess: (_data, variables) => {
      // Invalidate rather than patch — removal returns raw doc that may need normalization
      queryClient.invalidateQueries({ queryKey: franchiseKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: franchiseKeys.mine() });
      toast.success("Logo removed");
    },

    onError: (error) => {
      toast.error(getErrorMessage(error));
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