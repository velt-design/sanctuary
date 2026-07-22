import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { PortalSearchResponse } from '@/lib/search/portalSearchContract';
import { apiJson } from '@/lib/repo/apiClient';
import { qk } from './keys';

const FIVE_MINUTES = 1000 * 60 * 5;
const THIRTY_MINUTES = 1000 * 60 * 30;
export const PORTAL_SEARCH_DEBOUNCE_MS = 50;

export function normalizePortalSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase('en-NZ');
}

export function portalSearchQueryOptions(query: string) {
  const normalizedQuery = normalizePortalSearchQuery(query);
  return queryOptions({
    queryKey: qk.search.portal(normalizedQuery),
    queryFn: ({ signal }) => apiJson<PortalSearchResponse>(
      `/api/staff/v1/search?q=${encodeURIComponent(normalizedQuery)}`,
      { cache: 'no-store', signal },
    ),
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
  });
}

export function invalidatePortalSearchQueries(
  queryClient: QueryClient,
  refetchType: 'active' | 'none' = 'active',
) {
  return queryClient.invalidateQueries({ queryKey: qk.search.portalPrefix(), refetchType });
}
