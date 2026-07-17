import { axiosClient } from "@/api/axiosClient";
import type {
  ApiEnvelope,
  TournamentTeam,
  TeamRegistrationPayload,
} from "@/types/tournament";

export const teamApi = {
  create: async (payload: TeamRegistrationPayload) => {
    const { data } = await axiosClient.post<ApiEnvelope<TournamentTeam>>(
      "/franchise",
      payload
    );
    return data.data;
  },

  listMine: async (query?: Record<string, any>) => {
    const { data } = await axiosClient.get<ApiEnvelope<{ data: TournamentTeam[]; total: number; page: number; limit: number }>>(
      "/franchise/mine",
      { params: query }
    );
    return data;
  },

  getById: async (id: string) => {
    const { data } = await axiosClient.get<ApiEnvelope<TournamentTeam>>(
      `/franchise/${id}`
    );
    return data.data;
  },

  // Tournament-specific methods (matching old hooks)
  listByTournament: async (tournamentId: string) => {
    const { data } = await axiosClient.get<ApiEnvelope<TournamentTeam[]>>(
      `/tournaments/${tournamentId}/teams`
    );
    return data.data;
  },

  myRegistration: async (tournamentId: string, userId?: string) => {
    const { data } = await axiosClient.get<ApiEnvelope<TournamentTeam | null>>(
      `/tournaments/${tournamentId}/teams/mine`,
      { params: { userId } }
    );
    return data.data;
  },

  register: async (
    tournamentId: string,
    payload: TeamRegistrationPayload,
    userContext?: { id?: string; name?: string }
  ) => {
    const { data } = await axiosClient.post<ApiEnvelope<TournamentTeam>>(
      `/tournaments/${tournamentId}/teams/register`,
      { ...payload, ...userContext }
    );
    return data.data;
  },
};
