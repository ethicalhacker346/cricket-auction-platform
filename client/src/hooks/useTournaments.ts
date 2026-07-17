import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { tournamentApi, type ListTournamentsFilters } from "@/api/tournamentApi";
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

/**
 * Normalizes tournament data from API response.
 * Handles both envelope-wrapped and raw responses.
 * Ensures counts are numbers and id is always present.
 */
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

export function useTournaments(filters: ListTournamentsFilters = {}) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () => {
      const result = await tournamentApi.list(filters);
      // tournamentApi.list already returns Tournament[]
      const list = Array.isArray(result) ? result : [];
      return {
        data: list.map(normalizeTournament).filter(Boolean),
        pagination: null, // pagination not consumed by dashboard yet
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

export function useUpdateTournament(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<TournamentPayload>) => tournamentApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      toast.success("Tournament updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not update tournament")),
  });
}

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