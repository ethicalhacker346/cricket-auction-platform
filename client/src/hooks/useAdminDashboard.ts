import { useQuery } from '@tanstack/react-query';
import { adminDashboardApi } from '@/api/adminDashboardApi';

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'overview'],
    queryFn: () => adminDashboardApi.getOverview(12),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}