// src/api/franchiseApi.ts
import { axiosClient } from "@/api/axiosClient";
import type { ApiEnvelope } from "@/types/auth";

// ═══════════════════════════════════════════════════════════════════════════════
// Domain Types — derived from Franchise.js schema
// ═══════════════════════════════════════════════════════════════════════════════

export interface Franchise {
  id: string;               // Mongoose virtual id
  ownerId: string;          // Ref → User
  name: string;             // required, trim, maxlength: 120
  slug: string;             // required, lowercase, regex validated, globally unique
  logo?: string;            // validated URL
  city?: string;            // trim, maxlength: 80
  description?: string;     // maxlength: 1000
  isActive: boolean;        // default: true
  createdAt: string;
  updatedAt: string;
}

/** POST /franchises payload. ownerId omitted — backend pulls from auth session. */
export interface FranchisePayload {
  name: string;
  slug: string;
  logo?: string;
  city?: string;
  description?: string;
}

/** Query params for GET /franchises/mine */
export interface FranchiseListQuery {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
  sortBy?: "name" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export type FranchiseListResult = PaginatedResponse<Franchise>;

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════

export const franchiseApi = {
  /**
   * GET /franchises/mine
   * Authenticated. Returns paginated franchises owned by the current user.
   * Requires FRANCHISE_OWNER or ADMIN role (enforced by backend).
   */
  listMine: async (params?: FranchiseListQuery) => {
    const { data } = await axiosClient.get<ApiEnvelope<FranchiseListResult>>(
      "/franchises/mine",
      { params }
    );
    console.log("Axios response:", data);
    console.log("Returned to hook:", data.data);
    return data.data;
  },

  /**
   * POST /franchises
   * Authenticated. Creates a new franchise.
   * Requires FRANCHISE_OWNER or ADMIN role.
   */
  create: async (payload: FranchisePayload) => {
    const { data } = await axiosClient.post<ApiEnvelope<Franchise>>(
      "/franchises",
      payload
    );
    return data.data;
  },

  /**
   * GET /franchises/:id
   * Public. Fetch a single franchise by ID or slug.
   */
  getById: async (id: string) => {
    const { data } = await axiosClient.get<ApiEnvelope<Franchise>>(
      `/franchises/${id}`
    );
    return data.data;
  },

  /**
   * PATCH /franchises/:id
   * Authenticated. Partial update of a franchise.
   */
  update: async (id: string, payload: Partial<FranchisePayload>) => {
    const { data } = await axiosClient.patch<ApiEnvelope<Franchise>>(
      `/franchises/${id}`,
      payload
    );
    return data.data;
  },
};