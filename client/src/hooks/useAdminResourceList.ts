import { useQuery } from '@tanstack/react-query';
import { adminResourcesApi } from '@/api/adminResourcesApi';
import type { AdminResourceKind, ResourceQuery, ResourceResponseMap } from '@/types/adminResources';

export function useAdminResourceList<K extends AdminResourceKind>(
  kind: K,
  params: ResourceQuery = {},
  enabled = true
) {
  return useQuery({
    queryKey: ['admin', kind, params],
    queryFn: () => adminResourcesApi.list<K>(kind, params),
    enabled,
    staleTime: 20_000,
    // ✅ Only keep previous data if the kind matches
    placeholderData: (previousData, previousQuery) => {
      const previousKind = previousQuery?.queryKey[1];
      return previousKind === kind ? previousData : undefined;
    },
    retry: 1,
  });
}

export type ResourceData<K extends AdminResourceKind> = ResourceResponseMap[K];
