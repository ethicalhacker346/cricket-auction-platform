import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { teamApi } from "@/api/teamApi";
import { ApiError } from "@/api/http";
import { useAuthStore } from "@/store/authStore";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => teamApi.create(payload),
    onSuccess: (data) => {
      toast.success(`Team "${data.name}" created successfully!`);
      queryClient.invalidateQueries({ queryKey: ["teams", "mine"] });
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Could not create team"));
    },
  });
}

export function useMyTeams() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["teams", "mine"],
    queryFn: () => teamApi.listMine(),
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });
}

export function useTeamById(id: string) {
  return useQuery({
    queryKey: ["team", id],
    queryFn: () => teamApi.getById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// === Tournament-specific (preserved + improved from old useteams.ts) ===
export function useTournamentTeams(tournamentId: string | undefined) {
  return useQuery({
    queryKey: ["teams", tournamentId],
    queryFn: () => teamApi.listByTournament(tournamentId!),
    enabled: !!tournamentId,
  });
}

export function useMyTeamRegistration(tournamentId: string | undefined) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["teams", tournamentId, "mine", user?.id],
    queryFn: () => teamApi.myRegistration(tournamentId!, user?.id),
    enabled: !!tournamentId && !!user,
  });
}

export function useRegisterFranchise(tournamentId) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (payload) =>
      teamApi.register(tournamentId, payload, {
        id: user?.id,
        name: user?.name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Franchise registered! Awaiting organizer approval.");
    },
    onError: (err) =>
      toast.error(errorMessage(err, "Could not register franchise")),
  });
}
