import { uuidFromAppId } from '@/lib/supabase/mappers';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { loadDesignWorkbenchRouteContext } from '@/lib/drawings/loadDesignWorkbenchRouteContext';

export type WorkbenchRouteContext = Awaited<ReturnType<typeof loadDesignWorkbenchRouteContext>>;
export type WorkbenchReadFailure = { kind: 'error'; message: string; accessEnded: boolean };
export type WorkbenchContextRead = { kind: 'context'; context: WorkbenchRouteContext } | WorkbenchReadFailure;
export type WorkbenchEstimateRead = { kind: 'estimate'; estimate: EstimateDetail | null } | WorkbenchReadFailure;
export type WorkbenchPageRead = {
  context: Promise<WorkbenchContextRead>;
  estimate: Promise<WorkbenchEstimateRead>;
};

export function workbenchProjectMatches(left: string, right: string): boolean {
  if (left === right) return true;
  try { return uuidFromAppId(left, 'proj') === uuidFromAppId(right, 'proj'); }
  catch { return false; }
}
