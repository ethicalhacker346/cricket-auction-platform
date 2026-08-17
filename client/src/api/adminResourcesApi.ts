import { axiosClient } from '@/api/axiosClient';
import type { AdminResourceKind, ResourceQuery, ResourceResponseMap, PaginatedResult } from '@/types/adminResources';

interface PaginatedApiEnvelope<T> {
  success: boolean;
  data: T[];
  pagination?: PaginatedResult<T>['pagination'];
  meta?: PaginatedResult<T>['meta'];
  message?: string;
}

function normalizePageResponse<T>(value: unknown): PaginatedResult<T> {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const data = Array.isArray(root.data) ? root.data as T[] : [];
  const pagination = (root.pagination ?? root.meta) as PaginatedResult<T>['pagination'];
  return { data, pagination };
}

export const adminResourcesApi = {
  async list<K extends AdminResourceKind>(kind: K, params: ResourceQuery = {}): Promise<PaginatedResult<ResourceResponseMap[K]>> {
    const { data } = await axiosClient.get<PaginatedApiEnvelope<ResourceResponseMap[K]>>(`/admin-dashboard/${kind}`, { params });
    if (!data.success || !Array.isArray(data.data)) throw new Error(data.message ?? `Unable to load admin ${kind}`);
    return normalizePageResponse<ResourceResponseMap[K]>(data);
  },
};
