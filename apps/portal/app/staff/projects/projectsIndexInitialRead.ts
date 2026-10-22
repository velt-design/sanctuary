import type { QueryClient, QueryFunctionContext } from '@tanstack/react-query';
import { ApiError } from '@/lib/repo/apiClient';
import { projectsIndexQueryOptions } from '@/lib/queries/projectsIndex';
import type { ProjectsIndexParams, ProjectsIndexResponse } from '@/lib/projects/projectsIndexContract';

export type ProjectsIndexInitialResult =
  | { ok: true; data: ProjectsIndexResponse }
  | { ok: false; status: number; message: string };

export type ProjectsIndexInitialRead = {
  id: string;
  ownerId: string;
  params: ProjectsIndexParams;
  result: Promise<ProjectsIndexInitialResult>;
};

// Consumption markers only, scoped to the existing authenticated QueryClient.
// Never store the result, user, role or server client outside the request.
const consumedReads = new WeakMap<QueryClient, Set<string>>();

export function projectsIndexReadFunction(
  client: QueryClient,
  params: ProjectsIndexParams,
  ownerId: string | null,
  initial?: ProjectsIndexInitialRead,
) {
  const options = projectsIndexQueryOptions(params.archive, params);
  return async (context: QueryFunctionContext): Promise<ProjectsIndexResponse> => {
    const fallback = () => {
      if (typeof options.queryFn !== 'function') throw new Error('Projects index read function is unavailable');
      return options.queryFn({ ...context, queryKey: options.queryKey });
    };
    if (!initial) return fallback();
    const consumed = consumedReads.get(client) ?? new Set<string>();
    consumedReads.set(client, consumed);
    if (consumed.has(initial.id)) return fallback();
    // A changed filter also consumes the old render's handoff. Back or Retry
    // must never resurrect it after another query became the user's intent.
    consumed.add(initial.id);
    const initialKey = projectsIndexQueryOptions(initial.params.archive, initial.params).queryKey;
    const before = client.getQueryState(options.queryKey);
    if (ownerId !== initial.ownerId || JSON.stringify(initialKey) !== JSON.stringify(options.queryKey)
      || before?.data !== undefined || before?.isInvalidated) return fallback();

    const result = await new Promise<ProjectsIndexInitialResult>((resolve, reject) => {
      const abort = () => reject(new DOMException('Projects read superseded', 'AbortError'));
      if (context.signal.aborted) { abort(); return; }
      context.signal.addEventListener('abort', abort, { once: true });
      // Flight supplies a thenable whose .then does not return a native Promise.
      Promise.resolve(initial.result).then(resolve, reject).finally(() => context.signal.removeEventListener('abort', abort));
    });
    const current = client.getQueryState(options.queryKey);
    if (current?.dataUpdateCount !== before?.dataUpdateCount || current?.errorUpdateCount !== before?.errorUpdateCount
      || current?.isInvalidated) return fallback();
    if (!result.ok) throw new ApiError(result.message, { status: result.status, body: { error: result.message } });
    return result.data;
  };
}
