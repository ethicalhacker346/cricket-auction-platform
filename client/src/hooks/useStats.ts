import { useQuery } from '@tanstack/react-query';
import { fetchPublicStats, type PublicStats } from '@/api/statsApi';

const STALE_TIME = 5 * 60 * 1000; // 5 min — counts don't change fast enough to hammer the API

export function usePublicStats() {
  return useQuery<PublicStats, Error>({
    queryKey: ['publicStats'],
    queryFn: fetchPublicStats,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
}