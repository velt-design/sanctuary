import 'server-only';

export const projectFilesPhases = ['auth', 'bindings_rpc', 'token', 'library', 'source_batch', 'ancestry', 'children', 'content_redirect', 'source_headers'] as const;
export type ProjectFilesPhase = typeof projectFilesPhases[number];
export type ProjectFilesTimingObserver = (phase: ProjectFilesPhase, durationMs: number) => unknown;

/** Per-request observation only; never changes an operation's result or error. */
export async function measureProjectFilesPhase<T>(phase: ProjectFilesPhase, observer: ProjectFilesTimingObserver | undefined, work: () => PromiseLike<T> | T): Promise<T> {
  if (!observer) return work();
  let start: number;
  try { start = performance.now(); } catch { return work(); }
  try { return await work(); }
  finally {
    try {
      const duration = performance.now() - start;
      if (Number.isFinite(duration) && duration >= 0) void Promise.resolve(observer(phase, duration)).catch(() => undefined);
    } catch { /* Observation cannot change authorization, reads or errors. */ }
  }
}
