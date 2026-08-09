// src/api/tournamentApi.ts
import { axiosClient } from "@/api/axiosClient";
import type { ApiEnvelope } from "@/types/auth";
import type { Tournament, TournamentPayload, TournamentStatus } from "@/types/tournament";

// Raw tournament from backend (MongoDB shape with possible populated organizerId)
interface RawTournament extends Omit<Tournament, "organizerName" | "teamsCount" | "playersCount" | "organizerId"> {
  organizerId: string | { _id: string; name: string };
}

function toTournament(raw: RawTournament): Tournament {
  const organizerIsPopulated =
    typeof raw.organizerId === "object" && raw.organizerId !== null;

  return {
    ...raw,
    id: (raw as any)._id?.toString?.() ?? (raw as any).id ?? "",
    organizerId: organizerIsPopulated
      ? (raw.organizerId as any)._id ?? (raw.organizerId as any).id ?? ""
      : (raw.organizerId as string),
    organizerName: organizerIsPopulated ? (raw.organizerId as any).name : "",
    teamsCount: typeof raw.teamsCount === "number" ? raw.teamsCount : 0,
    playersCount: typeof raw.playersCount === "number" ? raw.playersCount : 0,
  } as Tournament;
}

function unwrap<T>(res: any): T {
  const envelope = res?.data ?? res;
  return envelope?.data ?? envelope;
}

function unwrapList<T>(res: any): T[] {
  const envelope = res?.data ?? res;
  const list = Array.isArray(envelope) ? envelope : envelope?.data ?? [];
  return Array.isArray(list) ? list : [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW: Image Upload Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface TournamentImageUploadResult {
  logo: string;
  meta: {
    format: string;
    width: number;
    height: number;
    bytes: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════

export interface ListTournamentsFilters {
  status?: TournamentStatus[];
  organizerId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const tournamentApi = {
  async list(filters: ListTournamentsFilters = {}): Promise<Tournament[]> {
    const params: Record<string, string | number> = {};
    if (filters.organizerId) params.organizerId = filters.organizerId;
    if (filters.status?.length === 1) params.status = filters.status[0];
    if (filters.search?.trim()) params.search = filters.search.trim();
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;

    const response = await axiosClient.get<any>("/tournaments", { params });
    const rawList = unwrapList<RawTournament>(response);

    let results = rawList.map(toTournament);

    if (filters.status && filters.status.length > 1) {
      results = results.filter((t) => filters.status!.includes(t.status));
    }

    return results;
  },

  async getById(id: string): Promise<Tournament> {
    const response = await axiosClient.get<any>(`/tournaments/${id}`);
    return toTournament(unwrap<RawTournament>(response));
  },

  async create(payload: TournamentPayload): Promise<Tournament> {
    const { slug: _slug, ...body } = payload;
    const response = await axiosClient.post<any>("/tournaments", body);
    return toTournament(unwrap<RawTournament>(response));
  },

  /**
   * LIBRARY PATH: Select a pre-made logo from your asset library.
   */
  async update(id: string, payload: Partial<TournamentPayload>): Promise<Tournament> {
    const { slug: _slug, ...body } = payload;
    const response = await axiosClient.patch<any>(`/tournaments/${id}`, body);
    return toTournament(unwrap<RawTournament>(response));
  },

  async openPlayerRegistration(id: string): Promise<Tournament> {
    const response = await axiosClient.post<any>(`/tournaments/${id}/open-player-registration`);
    return toTournament(unwrap<RawTournament>(response));
  },

  async openTeamRegistration(id: string): Promise<Tournament> {
    const response = await axiosClient.post<any>(`/tournaments/${id}/open-team-registration`);
    return toTournament(unwrap<RawTournament>(response));
  },

  async markTeamsApproved(id: string): Promise<Tournament> {
    const response = await axiosClient.post<any>(`/tournaments/${id}/approve-teams`);
    return toTournament(unwrap<RawTournament>(response));
  },

  async scheduleAuction(id: string, auctionDate?: string): Promise<Tournament> {
    const response = await axiosClient.post<any>(`/tournaments/${id}/schedule-auction`, { auctionDate });
    return toTournament(unwrap<RawTournament>(response));
  },

  async startAuction(id: string): Promise<Tournament> {
    const response = await axiosClient.post<any>(`/tournaments/${id}/start-auction`);
    return toTournament(unwrap<RawTournament>(response));
  },

  async completeAuction(id: string): Promise<Tournament> {
    const response = await axiosClient.post<any>(`/tournaments/${id}/complete-auction`);
    return toTournament(unwrap<RawTournament>(response));
  },

  async completeTournament(id: string): Promise<Tournament> {
    const response = await axiosClient.post<any>(`/tournaments/${id}/complete-tournament`);
    return toTournament(unwrap<RawTournament>(response));
  },

  async cancel(id: string): Promise<Tournament> {
    const response = await axiosClient.post<any>(`/tournaments/${id}/cancel`);
    return toTournament(unwrap<RawTournament>(response));
  },

  // ─── NEW: CUSTOM UPLOAD PATH ───────────────────────────────────────────────
  async uploadLogo(id: string, file: File): Promise<TournamentImageUploadResult> {
    const formData = new FormData();
    formData.append("image", file);

    const response = await axiosClient.patch<any>(
      `/tournaments/${id}/logo`,
      formData,
      {
        headers: { "Content-Type": undefined },
      }
    );
    return unwrap<TournamentImageUploadResult>(response);
  },

  async removeLogo(id: string): Promise<Tournament> {
    const response = await axiosClient.delete<any>(`/tournaments/${id}/logo`);
    return toTournament(unwrap<RawTournament>(response));
  },
};