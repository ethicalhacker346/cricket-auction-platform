// src/api/playerApi.ts
import { axiosClient } from "@/api/axiosClient";
import type { ApiEnvelope } from "@/types/auth";

// ═══════════════════════════════════════════════════════════════════════════════
// Domain Types — derived directly from the Player.js schema
// ═══════════════════════════════════════════════════════════════════════════════

/** Mirrors Object.values(PLAYER_ROLES) from the backend constants. */
export type PlayerRole = "BATSMAN" | "BOWLER" | "ALL_ROUNDER" | "WICKET_KEEPER";

/**
 * Runtime Player entity.
 * Maps 1-to-1 to the Mongoose schema (Player.js) with ObjectIds serialized
 * to strings and Dates serialized to ISO strings via toJSON.
 */
export interface Player {
  id: string;               // Mongoose virtual id (virtuals: true)
  userId: string;           // Ref → User; injected by service from req.user._id
  fullName: string;         // required, trim, maxlength: 120
  dateOfBirth?: string;     // ISO date; validated: min 15 years old
  nationality?: string;      // trim, maxlength: 60
  primaryRole: PlayerRole;  // enum, required, indexed
  battingStyle?: string;    // trim, maxlength: 40
  bowlingStyle?: string;    // trim, maxlength: 40
  profileImage?: string;    // validated as http/https URL
  bio?: string;             // maxlength: 1000
  isActive: boolean;        // default: true, indexed
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /players payload.
 * userId is omitted — the backend pulls it from the authenticated session.
 * isActive is omitted — it defaults to true on creation.
 */
export interface PlayerPayload {
  fullName: string;
  primaryRole: PlayerRole;
  dateOfBirth?: string;
  nationality?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  profileImage?: string;
  bio?: string;
}

/** Query params for GET /players (list / browse). */
export interface PlayerListQuery {
  page?: number;
  limit?: number;
  /** Filter by the compound index { primaryRole: 1, isActive: 1 } */
  primaryRole?: PlayerRole;
  isActive?: boolean;
  /** Full-text search against the { fullName: 'text' } index */
  search?: string;
  sortBy?: "fullName" | "primaryRole" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

/** Shape returned by PlayerService.list and spread into the response envelope. */
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
// API — 1:1 mapping with player.routes.js + authApi.ts envelope pattern
// ═══════════════════════════════════════════════════════════════════════════════

export const playerApi = {
  /**
   * GET /players
   * Public browse endpoint. Supports filtering, sorting, pagination, and
   * full-text search via the Player schema text index on fullName.
   */
  list: async (params?: PlayerListQuery) => {
    const { data } = await axiosClient.get<ApiEnvelope<PlayerListResult>>(
      "/players",
      { params }
    );
    return data.data;
  },

  /**
   * GET /players/me
   * Authenticated. Returns the current user's own player profile.
   */
  me: async () => {
    const { data } = await axiosClient.get<ApiEnvelope<Player>>("/players/me");
    return data.data;
  },

  /**
   * POST /players
   * Authenticated. Creates a player profile for the logged-in user.
   * Validated by createPlayerSchema on the backend.
   */
  create: async (payload: PlayerPayload) => {
    const { data } = await axiosClient.post<ApiEnvelope<Player>>(
      "/players",
      payload
    );
    return data.data;
  },

  /**
   * PATCH /players/me
   * Authenticated. Partial update of the current user's profile.
   * Backend validates with createPlayerSchema.partial().
   */
  updateMe: async (payload: Partial<PlayerPayload>) => {
    const { data } = await axiosClient.patch<ApiEnvelope<Player>>(
      "/players/me",
      payload
    );
    return data.data;
  },

  /**
   * GET /players/:id
   * Public. Fetch a single player profile by its Mongo id.
   */
  getById: async (id: string) => {
    const { data } = await axiosClient.get<ApiEnvelope<Player>>(
      `/players/${id}`
    );
    return data.data;
  },
};