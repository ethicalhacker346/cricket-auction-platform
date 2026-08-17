import { axiosClient } from '@/api/axiosClient';
import type { AdminOverview } from '@/types/adminDashboard';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const adminDashboardApi = {
  async getOverview(recentActivityLimit = 12) {
    const { data } = await axiosClient.get<ApiEnvelope<AdminOverview>>(
      '/admin/dashboard/overview',
      { params: { recentActivityLimit } },
    );
    return data.data;
  },
};

export async function getAdminDashboardOverview(recentActivityLimit = 12) {
  return adminDashboardApi.getOverview(recentActivityLimit);
}