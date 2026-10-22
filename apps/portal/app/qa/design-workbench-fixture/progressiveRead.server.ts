import 'server-only';
import { PostgrestError } from '@supabase/supabase-js';
import { loadWorkbenchPageRead } from '@/app/staff/projects/[projectId]/design-workbench/loadWorkbenchPageRead.server';
import type { WorkbenchRouteContext } from '@/app/staff/projects/[projectId]/design-workbench/workbenchPageRead';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { SanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures.types';

export type WorkbenchFixtureScenario = 'complete' | 'failure' | 'denied' | 'empty';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Called only after the existing hidden fixture flag and valid baked fixture. */
export function progressiveWorkbenchFixture(fixture: SanctuaryGeometryWorkbenchFixture, source: 'a' | 'b', scenario: WorkbenchFixtureScenario) {
  const projectId = `proj_workbench_progressive_${source}`;
  const estimateId = `est_workbench_progressive_${source}`;
  const estimate = {
    ...fixture.estimate, id: estimateId, projectId, versionLabel: `Fictional design ${source.toUpperCase()}`,
    summary: {}, internalNotes: null, calculatorSnapshot: null, editability: { isLocked: false },
  } as EstimateDetail;
  const project = { id: projectId, name: `Fictional courtyard ${source.toUpperCase()}`, siteAddress: null };
  const read = loadWorkbenchPageRead({ projectId, estimateId }, {
    context: async (): Promise<WorkbenchRouteContext> => {
      await delay(900);
      if (scenario === 'empty') return { kind: 'no_estimate', project, providedEstimateId: estimateId, providedRequestId: null };
      return { kind: 'ready', project, estimate: { ...fixture.estimate, id: estimateId, versionLabel: estimate.versionLabel, isActiveDraft: true, selectionSource: 'query' }, request: null, estimateWarning: null, requestWarning: null, providedEstimateId: estimateId, providedRequestId: null };
    },
    estimate: async () => {
      await delay(1400);
      if (scenario === 'denied') throw new PostgrestError({ code: '42501', message: 'Controlled fictional permission refusal', details: '', hint: '' });
      if (scenario === 'failure') throw Object.assign(new Error('Controlled fictional read failure'), { status: 503 });
      return estimate;
    },
  });
  return { projectId, estimateId, read };
}
