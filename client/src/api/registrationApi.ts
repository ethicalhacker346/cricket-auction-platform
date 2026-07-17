// src/api/registrationApi.ts
import { axiosClient } from "@/api/axiosClient";
import type { ApiEnvelope } from "@/types/auth";
import type {
  PaginatedResult,
  PlayerListQueryParams,
  PlayerRegistration,
  RegisterPlayerPayload,
  RegisterTeamPayload,
  RejectPayload,
  SquadExportResponse,
  TeamListQueryParams,
  TeamRegistration,
} from "@/types/registration";

const registrationsBase = (tournamentId: string) =>
  `/tournaments/${tournamentId}/registrations`;

/* ═════════════════════════════════════════════════════════════════
   RESPONSE UNWRAPPERS
   Handles both intercepted (body only) and raw axios responses.
   ═════════════════════════════════════════════════════════════════ */

function unwrapEnvelope<T>(res: any): T {
  // res might be: AxiosResponse { data: { success, data } }
  // or already unwrapped: { success, data }
  const body = res?.data ?? res;
  return body?.data ?? body;
}

function unwrapPaginated<T>(res: any): PaginatedResult<T> {
  // Backend returns: { success: true, data: [...], total, page, limit }
  const body = res?.data ?? res;

  // If body is already the paginated result (with data array)
  if (body && Array.isArray(body.data)) {
    return {
      data: body.data,
      total: body.total ?? body.data.length,
      page: body.page ?? 1,
      limit: body.limit ?? body.data.length,
    };
  }

  // If body IS the array directly (edge case)
  if (Array.isArray(body)) {
    return {
      data: body,
      total: body.length,
      page: 1,
      limit: body.length,
    };
  }

  // Fallback: empty
  return { data: [], total: 0, page: 1, limit: 20 };
}

/* ═════════════════════════════════════════════════════════════════
   API
   ═════════════════════════════════════════════════════════════════ */

export const registrationApi = {
  // ─── Players ───
  registerPlayer: async (tournamentId: string, payload: RegisterPlayerPayload) => {
    const res = await axiosClient.post<any>(
      `${registrationsBase(tournamentId)}/players`,
      payload
    );
    return unwrapEnvelope<PlayerRegistration>(res);
  },

  /**
   * List player registrations.
   * Pass userId: "me" to get only the current user's registration.
   */
  listPlayers: async (tournamentId: string, params?: PlayerListQueryParams) => {
    const res = await axiosClient.get<any>(
      `${registrationsBase(tournamentId)}/players`,
      { params }
    );
    return unwrapPaginated<PlayerRegistration>(res);
  },

  verifyPlayer: async (tournamentId: string, registrationId: string) => {
    const res = await axiosClient.patch<any>(
      `${registrationsBase(tournamentId)}/players/${registrationId}/verify`
    );
    return unwrapEnvelope<PlayerRegistration>(res);
  },

   setPlayerBasePrice: async (
     tournamentId: string,
     registrationId: string,
     payload: { basePrice: number }
   ) => {
     const res = await axiosClient.patch<any>(
       `${registrationsBase(tournamentId)}/players/${registrationId}/base-price`,
        payload
      );
     return unwrapEnvelope<PlayerRegistration>(res);
    },

  rejectPlayer: async (
    tournamentId: string,
    registrationId: string,
    payload: RejectPayload
  ) => {
    const res = await axiosClient.patch<any>(
      `${registrationsBase(tournamentId)}/players/${registrationId}/reject`,
      payload
    );
    return unwrapEnvelope<PlayerRegistration>(res);
  },

  // ─── Teams ───
  registerTeam: async (tournamentId: string, payload: RegisterTeamPayload) => {
    const res = await axiosClient.post<any>(
      `${registrationsBase(tournamentId)}/teams`,
      payload
    );
    return unwrapEnvelope<TeamRegistration>(res);
  },

  /**
   * List team registrations.
   * Pass ownerId: "me" to get only the current owner's teams.
   */
  listTeams: async (tournamentId: string, params?: TeamListQueryParams) => {
    const res = await axiosClient.get<any>(
      `${registrationsBase(tournamentId)}/teams`,
      { params }
    );
    return unwrapPaginated<TeamRegistration>(res);
  },

  approveTeam: async (tournamentId: string, teamId: string) => {
    const res = await axiosClient.patch<any>(
      `${registrationsBase(tournamentId)}/teams/${teamId}/approve`
    );
    return unwrapEnvelope<TeamRegistration>(res);
  },

  rejectTeam: async (tournamentId: string, teamId: string, payload: RejectPayload) => {
    const res = await axiosClient.patch<any>(
      `${registrationsBase(tournamentId)}/teams/${teamId}/reject`,
      payload
    );
    return unwrapEnvelope<TeamRegistration>(res);
  },

  // ─── Squads ───
  exportSquads: async (tournamentId: string) => {
    const res = await axiosClient.get<any>(
      `${registrationsBase(tournamentId)}/squads/export`
    );
    return unwrapEnvelope<SquadExportResponse>(res);
  },
};