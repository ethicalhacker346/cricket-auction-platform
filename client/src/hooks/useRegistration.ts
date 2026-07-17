// src/hooks/useRegistration.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { registrationApi } from "@/api/registrationApi";
import { getErrorMessage } from "@/lib/utils/errorMessage";
import type {
  PlayerListQueryParams,
  RegisterPlayerPayload,
  RegisterTeamPayload,
  RejectPayload,
  TeamListQueryParams,
} from "@/types/registration";

export const registrationKeys = {
  all: (tournamentId: string) => ["registrations", tournamentId] as const,
  players: (tournamentId: string, params?: PlayerListQueryParams) =>
    [...registrationKeys.all(tournamentId), "players", params ?? {}] as const,
  teams: (tournamentId: string, params?: TeamListQueryParams) =>
    [...registrationKeys.all(tournamentId), "teams", params ?? {}] as const,
  myPlayer: (tournamentId: string) => [...registrationKeys.all(tournamentId), "my-player"] as const,
  myTeam: (tournamentId: string) => [...registrationKeys.all(tournamentId), "my-team"] as const,
  squads: (tournamentId: string) =>
    [...registrationKeys.all(tournamentId), "squads"] as const,
};

const tournamentKeys = {
  all: ["tournaments"] as const,
  detail: (id: string) => [...tournamentKeys.all, "detail", id] as const,
};

// ═════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════

function invalidateAllRegistrationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  tournamentId: string
) {
  queryClient.invalidateQueries({ queryKey: registrationKeys.all(tournamentId) });
  queryClient.invalidateQueries({ queryKey: registrationKeys.myPlayer(tournamentId) });
  queryClient.invalidateQueries({ queryKey: registrationKeys.myTeam(tournamentId) });
  queryClient.invalidateQueries({ queryKey: registrationKeys.squads(tournamentId) });
  queryClient.invalidateQueries({ queryKey: tournamentKeys.detail(tournamentId) });
}

// ═════════════════════════════════════════════════════════════════
// Players
// ═════════════════════════════════════════════════════════════════

export function usePlayers(tournamentId: string, params?: PlayerListQueryParams) {
  return useQuery({
    queryKey: registrationKeys.players(tournamentId, params),
    queryFn: async () => {
      const result = await registrationApi.listPlayers(tournamentId, params);
      return result.data ?? [];
    },
    enabled: !!tournamentId,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Checks if the CURRENT user has registered as a player.
 * Returns the registration object if found, null if not registered.
 *
 * CRITICAL: We query with userId: "me" AND verify the returned item
 * actually belongs to the current user (defense against backend bugs).
 */
export function useMyPlayerRegistration(tournamentId: string) {
  return useQuery({
    queryKey: registrationKeys.myPlayer(tournamentId),
    queryFn: async () => {
      const result = await registrationApi.listPlayers(tournamentId, {
        userId: "me",
        limit: 1,
      });

      const list = result.data ?? [];
      if (list.length === 0) return null;

      const item = list[0];

      // Defensive: if backend returned ALL players instead of filtering,
      // we verify this item actually has userId: "me" or belongs to current user.
      // If the item has a userId field and it's NOT "me", return null.
      if (item.userId && item.userId !== "me") {
        // Try to find the correct one in the full list
        const fullResult = await registrationApi.listPlayers(tournamentId, { userId: "me", limit: 50 });
        const fullList = fullResult.data ?? [];
        const mine = fullList.find((p) => p.userId === "me" || p.isMine === true);
        return mine ?? null;
      }

      return item ?? null;
    },
    enabled: !!tournamentId,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useRegisterPlayer(tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegisterPlayerPayload = {}) =>
      registrationApi.registerPlayer(tournamentId, payload),
    onSuccess: () => {
      invalidateAllRegistrationQueries(queryClient, tournamentId);
      toast.success("Registration submitted. Awaiting organizer approval.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useVerifyPlayer(tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (registrationId: string) =>
      registrationApi.verifyPlayer(tournamentId, registrationId),
    onSuccess: () => {
      invalidateAllRegistrationQueries(queryClient, tournamentId);
      toast.success("Player approved.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useRejectPlayer(tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      registrationId,
      reason,
    }: {
      registrationId: string;
    } & RejectPayload) => registrationApi.rejectPlayer(tournamentId, registrationId, { reason }),
    onSuccess: () => {
      invalidateAllRegistrationQueries(queryClient, tournamentId);
      toast.success("Player rejected.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useSetPlayerBasePrice(tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      registrationId,
      basePrice,
    }: {
      registrationId: string;
      basePrice: number;
    }) => registrationApi.setPlayerBasePrice(tournamentId, registrationId, { basePrice }),
    onSuccess: () => {
      invalidateAllRegistrationQueries(queryClient, tournamentId);
      toast.success("Base price updated.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// ═════════════════════════════════════════════════════════════════
// Teams
// ═════════════════════════════════════════════════════════════════

export function useTeams(tournamentId: string, params?: TeamListQueryParams) {
  return useQuery({
    queryKey: registrationKeys.teams(tournamentId, params),
    queryFn: async () => {
      const result = await registrationApi.listTeams(tournamentId, params);
      return result.data ?? [];
    },
    enabled: !!tournamentId,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Checks if the CURRENT user (as franchise owner) has registered any team(s).
 * Returns an array of teams. Empty array = not registered.
 */
export function useMyTeamRegistrations(tournamentId: string) {
  return useQuery({
    queryKey: registrationKeys.myTeam(tournamentId),
    queryFn: async () => {
      const result = await registrationApi.listTeams(tournamentId, {
        ownerId: "me",
        limit: 50,
      });
      return result.data ?? [];
    },
    enabled: !!tournamentId,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Legacy hook: returns the first team or null.
 */
export function useMyTeamRegistration(tournamentId: string) {
  const { data: teams, ...rest } = useMyTeamRegistrations(tournamentId);
  return {
    data: teams?.[0] ?? null,
    ...rest,
  };
}

export function useRegisterTeam(tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegisterTeamPayload) =>
      registrationApi.registerTeam(tournamentId, payload),
    onSuccess: () => {
      invalidateAllRegistrationQueries(queryClient, tournamentId);
      toast.success("Team registration submitted. Awaiting organizer approval.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useApproveTeam(tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => registrationApi.approveTeam(tournamentId, teamId),
    onSuccess: () => {
      invalidateAllRegistrationQueries(queryClient, tournamentId);
      toast.success("Team approved.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useRejectTeam(tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, reason }: { teamId: string } & RejectPayload) =>
      registrationApi.rejectTeam(tournamentId, teamId, { reason }),
    onSuccess: () => {
      invalidateAllRegistrationQueries(queryClient, tournamentId);
      toast.success("Team rejected.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// ═════════════════════════════════════════════════════════════════
// Squads
// ═════════════════════════════════════════════════════════════════

export function useSquadExport(tournamentId: string) {
  return useQuery({
    queryKey: registrationKeys.squads(tournamentId),
    queryFn: () => registrationApi.exportSquads(tournamentId),
    enabled: false,
  });
}