// src/api/franchiseApi.ts
import { axiosClient } from "@/api/axiosClient";
import type { ApiEnvelope } from "@/types/auth";

// ═══════════════════════════════════════════════════════════════════════════════
// Domain Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface Franchise {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  logo?: string;
  city?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FranchisePayload {
  name: string;
  slug: string;
  logo?: string;            // ← LIBRARY PATH: pass a public URL string
  city?: string;
  description?: string;
}

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
// NEW: Image Upload Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface FranchiseImageUploadResult {
  logo: string;
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

export const franchiseApi = {
  listMine: async (params?: FranchiseListQuery) => {
    const { data } = await axiosClient.get<ApiEnvelope<FranchiseListResult>>(
      "/franchises/mine",
      { params }
    );
    return data.data;
  },

  create: async (payload: FranchisePayload) => {
    const { data } = await axiosClient.post<ApiEnvelope<Franchise>>(
      "/franchises",
      payload
    );
    return data.data;
  },

  getById: async (id: string) => {
    const { data } = await axiosClient.get<ApiEnvelope<Franchise>>(
      `/franchises/${id}`
    );
    return data.data;
  },

  /**
   * LIBRARY PATH: Select a pre-made logo from your asset library.
   */
  update: async (id: string, payload: Partial<FranchisePayload>) => {
    const { data } = await axiosClient.patch<ApiEnvelope<Franchise>>(
      `/franchises/${id}`,
      payload
    );
    return data.data;
  },

  // ─── NEW: CUSTOM UPLOAD PATH ───────────────────────────────────────────────
  uploadLogo: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);

    const { data } = await axiosClient.patch<ApiEnvelope<FranchiseImageUploadResult>>(
      `/franchises/${id}/logo`,
      formData,
      {
        headers: { "Content-Type": undefined },
      }
    );
    return data.data;
  },

  removeLogo: async (id: string) => {
    const { data } = await axiosClient.delete<ApiEnvelope<Franchise>>(
      `/franchises/${id}/logo`
    );
    return data.data;
  },
};