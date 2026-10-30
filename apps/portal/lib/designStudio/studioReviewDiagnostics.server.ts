import 'server-only';
import { applyRouteDiagnostics, createRouteDiagnostics, logPortalServerWarn } from '@/lib/api/routeDiagnostics';

type Stage = 'guard' | 'target' | 'version-metadata' | 'quote-authority' | 'project-display' |
  'quote-access' | 'quote-detail' | 'legacy-draft' | 'related-quotes' | 'source-reference' | 'projection' | 'theme' | 'price-preparation' | 'price-calculation';
type Entry = { stage: Stage; startMs: number; durationMs?: number; state: 'pending' | 'settled' | 'rejected' };

/** Fixed scalar stages only. Never accept request payloads, identities or errors. */
export function createStudioReviewDiagnostics() {
  const context = createRouteDiagnostics(null, '/api/projects/[projectId]/estimates/[estimateId]/studio-review', 'GET');
  const enabled = process.env.STUDIO_REQUEST_DIAGNOSTICS === '1';
  const startedAtUtc = new Date().toISOString();
  const stages: Entry[] = [];
  let finished = false;
  return {
    context,
    async measure<T>(stage: Stage, work: () => T | PromiseLike<T>): Promise<T> {
      const entry: Entry | null = enabled && !finished && stages.length < 14
        ? { stage, startMs: Number((performance.now() - context.startedAt).toFixed(1)), state: 'pending' } : null;
      const started = performance.now();
      if (entry) stages.push(entry);
      try {
        const result = await work();
        if (entry) entry.state = 'settled';
        return result;
      } catch (error) {
        if (entry) entry.state = 'rejected';
        throw error;
      } finally {
        if (entry) entry.durationMs = Number((performance.now() - started).toFixed(1));
      }
    },
    apply(response: Response) {
      try { applyRouteDiagnostics(response, context); } catch { /* Diagnostics cannot change the result. */ }
    },
    finish(outcome: 'response' | 'failure', status: number) {
      if (finished) return;
      finished = true;
      if (!enabled) return;
      try {
        logPortalServerWarn(context, { event: 'studio.review_diagnostics', message: 'Studio review completed', status,
          extra: { startedAtUtc, outcome, stages: stages.map(entry => ({ ...entry })) } });
      } catch { /* Logging is never an authority or data dependency. */ }
    },
  };
}
export type StudioReviewDiagnostics = ReturnType<typeof createStudioReviewDiagnostics>;
