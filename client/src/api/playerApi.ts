// src/api/playerApi.ts
import { axiosClient } from "@/api/axiosClient";
import type { ApiEnvelope } from "@/types/auth";

// ═══════════════════════════════════════════════════════════════════════════════
// Domain Types
// ═══════════════════════════════════════════════════════════════════════════════

export type PlayerRole = "BATSMAN" | "BOWLER" | "ALL_ROUNDER" | "WICKET_KEEPER";

export interface Player {
  id: string;
  userId: string;
  fullName: string;
  dateOfBirth?: string;
  nationality?: string;
  primaryRole: PlayerRole;
  battingStyle?: string;
  bowlingStyle?: string;
  profileImage?: string;
  bio?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerPayload {
  fullName: string;
  primaryRole: PlayerRole;
  dateOfBirth?: string;
  nationality?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  profileImage?: string;   // ← LIBRARY PATH: pass a public URL string
  bio?: string;
}

export interface PlayerListQuery {
  page?: number;
  limit?: number;
  primaryRole?: PlayerRole;
  isActive?: boolean;
  search?: string;
  sortBy?: "fullName" | "primaryRole" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface PlayerListResult {
  players: Player[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW: Image Upload Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlayerImageUploadResult {
  profileImage: string;
  meta: {
    format: string;
    width: number;
    height: number;
    bytes: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════

export const playerApi = {
  list: async (params?: PlayerListQuery) => {
    const { data } = await axiosClient.get<ApiEnvelope<PlayerListResult>>(
      "/players",
      { params }
    );
    return data.data;
  },

  me: async () => {
    const { data } = await axiosClient.get<ApiEnvelope<Player>>("/players/me");
    return data.data;
  },

  create: async (payload: PlayerPayload) => {
    const { data } = await axiosClient.post<ApiEnvelope<Player>>(
      "/players",
      payload
    );
    return data.data;
  },

  /**
   * LIBRARY PATH: Select a pre-made image from your asset library.
   * Just pass the absolute URL as profileImage in the payload.
   */
  updateMe: async (payload: Partial<PlayerPayload>) => {
    const { data } = await axiosClient.patch<ApiEnvelope<Player>>(
      "/players/me",
      payload
    );
    return data.data;
  },

  getById: async (id: string) => {
    const { data } = await axiosClient.get<ApiEnvelope<Player>>(
      `/players/${id}`
    );
    return data.data;
  },

  // ─── NEW: CUSTOM UPLOAD PATH ───────────────────────────────────────────────
  /**
   * CUSTOM PATH: Upload a user-selected image file directly to Cloudinary.
   * Sends multipart/form-data. The backend streams to Cloudinary and returns
   * the optimized CDN URL + metadata.
   */
  uploadProfileImage: async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);

    const { data } = await axiosClient.patch<ApiEnvelope<PlayerImageUploadResult>>(
      "/players/me/profile-image",
      formData,
      {
        // Let the browser set the correct multipart boundary automatically.
        // This overrides any default Content-Type: application/json on the axios instance.
        headers: { "Content-Type": undefined },
      }
    );
    return data.data;
  },

  /**
   * Remove the current profile image (deletes Cloudinary asset + clears DB field).
   */
  removeProfileImage: async () => {
    const { data } = await axiosClient.delete<ApiEnvelope<Player>>(
      "/players/me/profile-image"
    );
    return data.data;
  },
};