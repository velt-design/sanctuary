import type { QueryClient, QueryFunctionContext, QueryKey } from '@tanstack/react-query';
import { ApiError } from '@/lib/repo/apiClient';
import type { ProjectWorkInitialData, ProjectWorkInitialRead, ProjectWorkReadResult } from '@/lib/projects/projectWorkInitialRead';

const consumedReads = new WeakMap<QueryClient, Set<string>>();

/** Each existing query owns one matching Flight result; later reads use its ordinary API. */
export function projectWorkReadFunction<K extends keyof ProjectWorkInitialData, Q extends QueryKey>(
  client: QueryClient, key: Q, kind: K, host: string, projectId: string, ownerId: string | null,
  fallback: (context: QueryFunctionContext<Q>) => ProjectWorkInitialData[K] | Promise<ProjectWorkInitialData[K]>, initial?: ProjectWorkInitialRead,
) {
  return async (context: QueryFunctionContext<Q>): Promise<ProjectWorkInitialData[K]> => {
    const { signal } = context;
    const recover = () => fallback(context);
    if (!initial) return recover();
    const consumed = consumedReads.get(client) ?? new Set<string>();
    consumedReads.set(client, consumed);
    const id = `${initial.id}:${kind}`;
    if (consumed.has(id)) return recover();
    consumed.add(id);
    const before = client.getQueryState(key);
    if (ownerId !== initial.ownerId || host !== initial.host || projectId !== initial.projectId
      || before?.data !== undefined || before?.isInvalidated) return recover();

    let result: ProjectWorkReadResult<ProjectWorkInitialData[K]>;
    try {
      result = await new Promise((resolve, reject) => {
        const abort = () => reject(new DOMException('Project read superseded', 'AbortError'));
        if (signal.aborted) { abort(); return; }
        signal.addEventListener('abort', abort, { once: true });
        Promise.resolve(initial.results[kind]).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ApiError('Project could not be loaded.', { status: 503, body: {} });
    }
    const current = client.getQueryState(key);
    if (current?.dataUpdateCount !== before?.dataUpdateCount || current?.errorUpdateCount !== before?.errorUpdateCount
      || current?.isInvalidated) return recover();
    if (!result || (result.ok && (!result.data || typeof result.data !== 'object'))) {
      throw new ApiError('Project could not be loaded.', { status: 503, body: {} });
    }
    if (!result.ok) throw new ApiError(result.message, { status: result.status, body: { error: result.message } });
    return result.data;
  };
}
