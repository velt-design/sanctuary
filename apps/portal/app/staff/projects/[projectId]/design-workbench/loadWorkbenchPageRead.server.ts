import 'server-only';
import { loadDesignWorkbenchRouteContext } from '@/lib/drawings/loadDesignWorkbenchRouteContext';
import { loadProjectEstimateDetail } from '@/lib/estimates/loadProjectEstimateDetail';
import { workbenchProjectMatches } from './workbenchPageRead';
import type { WorkbenchContextRead, WorkbenchEstimateRead, WorkbenchPageRead, WorkbenchReadFailure } from './workbenchPageRead';

function failure(error: unknown): WorkbenchReadFailure {
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : null;
  // The installed estimate reader throws res.error, whose PostgrestError carries
  // code/message/details/hint but no response status. Only explicit authority
  // codes are fatal; schema, connection, timeout and unknown errors stay distinct.
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : '';
  const authorityCode = ['42501', 'PGRST301', 'PGRST302', 'PGRST303', 'PT401', 'PT403', 'PT404'].includes(code);
  return { kind: 'error', message: 'The selected workbench data could not be loaded. Retry the read.', accessEnded: status === 401 || status === 403 || status === 404 || authorityCode };
}

/** One context read owns selection; its exact estimate read is started once. */
export function loadWorkbenchPageRead(input: Parameters<typeof loadDesignWorkbenchRouteContext>[0], readers = { context: loadDesignWorkbenchRouteContext, estimate: loadProjectEstimateDetail }): WorkbenchPageRead {
  const context: Promise<WorkbenchContextRead> = readers.context(input).then((value) => ({ kind: 'context' as const, context: value })).catch(failure);
  const estimate: Promise<WorkbenchEstimateRead> = context.then(async (result) => {
    if (result.kind === 'error') return result;
    if (result.context.kind !== 'ready') return { kind: 'estimate', estimate: null };
    try {
      const detail = await readers.estimate(input.projectId, result.context.estimate.id);
      if (detail && (!workbenchProjectMatches(detail.projectId, input.projectId) || !workbenchProjectMatches(detail.projectId, result.context.project.id) || detail.id !== result.context.estimate.id)) return { kind: 'error', message: 'The selected estimate identity did not match this project.', accessEnded: true };
      return { kind: 'estimate', estimate: detail };
    } catch (error) { return failure(error); }
  });
  return { context, estimate };
}
