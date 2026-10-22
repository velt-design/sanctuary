import type { QueryClient, QueryFunctionContext } from '@tanstack/react-query';
import { apiJson, ApiError } from '@/lib/repo/apiClient';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
import { calendarVisitsSearch, type CalendarVisitScope, type CalendarVisitsInitialRead, type SavedVisitsResult } from '@/lib/siteVisits/savedVisitsContract';

export const calendarVisitKey = ['outlook-calendar-visits'] as const;
export const calendarVisitsQueryKey = (host: string, scope: CalendarVisitScope) =>
  [...calendarVisitKey, host, scope.project, scope.visit] as const;

// Render IDs only. Private results and authority stay with the request/query owner.
const consumedReads = new WeakMap<QueryClient, Set<string>>();
export function calendarVisitsReadFunction(
  client: QueryClient, host: string, scope: CalendarVisitScope, ownerId: string | null, initial?: CalendarVisitsInitialRead,
) {
  const key = calendarVisitsQueryKey(host, scope);
  return async ({ signal }: QueryFunctionContext): Promise<VisitSnapshot> => {
    const fallback = () => apiJson<VisitSnapshot>(`/api/staff/v1/outlook-site-visits?${calendarVisitsSearch(scope)}`, { signal, cache: 'no-store' });
    if (!initial) return fallback();
    const consumed = consumedReads.get(client) ?? new Set<string>();
    consumedReads.set(client, consumed);
    if (consumed.has(initial.id)) return fallback();
    consumed.add(initial.id);
    const before = client.getQueryState(key);
    if (ownerId !== initial.ownerId || host !== initial.host || scope.project !== initial.project || scope.visit !== initial.visit
      || before?.data !== undefined || before?.isInvalidated) return fallback();

    let result: SavedVisitsResult;
    try {
      result = await new Promise<SavedVisitsResult>((resolve, reject) => {
        const abort = () => reject(new DOMException('Site visit read superseded', 'AbortError'));
        if (signal.aborted) { abort(); return; }
        signal.addEventListener('abort', abort, { once: true });
        // React Flight's thenable does not return a Promise from .then.
        Promise.resolve(initial.result).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ApiError('Site visits could not be loaded.', { status: 503, body: {} });
    }
    const current = client.getQueryState(key);
    if (current?.dataUpdateCount !== before?.dataUpdateCount || current?.errorUpdateCount !== before?.errorUpdateCount
      || current?.isInvalidated) return fallback();
    if (!result || (result.ok && !Array.isArray(result.data?.events))) {
      throw new ApiError('Site visits could not be loaded.', { status: 503, body: {} });
    }
    if (!result.ok) throw new ApiError(result.message, { status: result.status, body: { error: result.message } });
    return result.data;
  };
}
