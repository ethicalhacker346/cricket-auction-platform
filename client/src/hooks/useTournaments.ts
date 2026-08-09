// src/hooks/useTournaments.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { tournamentApi, type ListTournamentsFilters, type TournamentImageUploadResult } from "@/api/tournamentApi";
import { ApiError } from "@/api/http";
import type { TournamentPayload } from "@/types/tournament";

const keys = {
  all: ["tournaments"] as const,
  list: (filters: ListTournamentsFilters) => [...keys.all, "list", filters] as const,
  detail: (id: string) => [...keys.all, "detail", id] as const,
};

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

function normalizeTournament(data: any) {
  if (!data) return null;
  const t = data.data ?? data;
  return {
    ...t,
    id: t._id?.toString?.() ?? t.id ?? "",
    playersCount: typeof t.playersCount === "number" ? t.playersCount : 0,
    teamsCount: typeof t.teamsCount === "number" ? t.teamsCount : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useTournaments(filters: ListTournamentsFilters = {}) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () => {
      const result = await tournamentApi.list(filters);
      const list = Array.isArray(result) ? result : [];
      return {
        data: list.map(normalizeTournament).filter(Boolean),
        pagination: null,
      };
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 3;
    },
  });
}

export function useTournament(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ""),
    queryFn: async () => {
      const result = await tournamentApi.getById(id as string);
      return normalizeTournament(result);
    },
    enabled: !!id,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useCreateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TournamentPayload) => tournamentApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      toast.success("Tournament created as a draft");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not create tournament")),
  });
}

/**
 * LIBRARY PATH: Update tournament fields including selecting a pre-made logo URL.
 */
export function useUpdateTournament(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<TournamentPayload>) => tournamentApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      queryClient.invalidateQueries({ queryKey: keys.detail(id) });
      toast.success("Tournament updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not update tournament")),
  });
}

// ─── NEW: CUSTOM UPLOAD PATH ────────────────────────────────────────────────
/**
 * CUSTOM PATH: Upload a user-selected logo file for a tournament.
 */
export function useUploadTournamentLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      tournamentApi.uploadLogo(id, file),

    onSuccess: (data, variables) => {
      // Instant cache patch
      queryClient.setQueryData(keys.detail(variables.id), (old: any) => {
        if (!old) return old;
        return { ...old, logo: data.logo, updatedAt: new Date().toISOString() };
      });

      // Logo is public-visible in lists
      queryClient.invalidateQueries({ queryKey: keys.all });
      toast.success("Tournament logo uploaded!");
    },

    onError: (err) => {
      toast.error(errorMessage(err, "Could not upload logo"));
    },
  });
}

/**
 * Remove tournament logo. Clears DB field + deletes Cloudinary asset.
 */
export function useRemoveTournamentLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => tournamentApi.removeLogo(id),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: keys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: keys.all });
      toast.success("Logo removed");
    },

    onError: (err) => {
      toast.error(errorMessage(err, "Could not remove logo"));
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIFECYCLE HOOKS (unchanged, included for completeness)
// ═══════════════════════════════════════════════════════════════════════════════

export function useOpenPlayerRegistration(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tournamentApi.openPlayerRegistration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      queryClient.invalidateQueries({ queryKey: keys.detail(id) });
      toast.success("Player registration is now open");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not open player registration")),
  });
}

export function useOpenTeamRegistration(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tournamentApi.openTeamRegistration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      queryClient.invalidateQueries({ queryKey: keys.detail(id) });
      toast.success("Team registration is now open");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not open team registration")),
  });
}

export function useMarkTeamsApproved(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tournamentApi.markTeamsApproved(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      queryClient.invalidateQueries({ queryKey: keys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ["teams", id] });
      toast.success("Teams approved successfully");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not approve teams")),
  });
}

export function useScheduleAuction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (auctionDate?: string) => tournamentApi.scheduleAuction(id, auctionDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      queryClient.invalidateQueries({ queryKey: keys.detail(id) });
      toast.success("Auction scheduled");
    },
       onError: (err) => toast.error(errorMessage(err, "Could not schedule auction")),
  });
}

export function useStartAuction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tournamentApi.startAuction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      queryClient.invalidateQueries({ queryKey: keys.detail(id) });
      toast.success("Auction started");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not start auction")),
  });
}

export function useCompleteAuction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tournamentApi.completeAuction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      queryClient.invalidateQueries({ queryKey: keys.detail(id) });
      toast.success("Auction completed");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not complete auction")),
  });
}

export function useCompleteTournament(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tournamentApi.completeTournament(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      queryClient.invalidateQueries({ queryKey: keys.detail(id) });
      toast.success("Tournament marked as completed");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not complete tournament")),
  });
}

export function useCancelTournament(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tournamentApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      queryClient.invalidateQueries({ queryKey: keys.detail(id) });
      toast.success("Tournament cancelled");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not cancel tournament")),
  });
}