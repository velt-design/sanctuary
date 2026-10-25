import { act, lazy, Suspense } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import ReadHost from './DesignWorkbenchReadHost';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import * as workingCopy from '@/lib/localFirst/useLocalWorkingCopy';
import { __resetLocalFirstStoreForTests, __setLocalFirstStorageAdapterForTests, ensureLocalFirstStoreReady, writeLocalFirstWorkingCopy } from '@/lib/localFirst/store';
import { buildEstimateDrawingDraftEntityKey } from '@/lib/localFirst/portalEntities';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { WorkbenchContextRead, WorkbenchEstimateRead } from './workbenchPageRead';
const { viewport } = vi.hoisted(() => ({ viewport: vi.fn() }));
vi.mock('next/dynamic', () => ({ default: (loader: () => Promise<any>) => lazy(loader) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/components/drawings/workbench/WorkbenchViewportHost', () => ({ default: (props: any) => { viewport(props); return <div data-actual-runtime-viewport data-mode={props.viewportMode} />; } }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((accept) => { resolve = accept; }); return { promise, resolve }; }
afterEach(() => { __resetLocalFirstStoreForTests(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('mounts the real draft/store/rail runtime only after complete identity and preserves the solved artifact across safe modes', async () => {
  __resetLocalFirstStoreForTests(); __setLocalFirstStorageAdapterForTests({ get: async () => undefined, set: async () => undefined }); await ensureLocalFirstStoreReady();
  const fixture = getSanctuaryGeometryWorkbenchFixture('multi-house-u-two-pergola')!;
  const estimate = { ...fixture.estimate, projectId: 'proj_1', summary: {}, internalNotes: null, calculatorSnapshot: null, editability: { isLocked: false } } as EstimateDetail;
  await writeLocalFirstWorkingCopy({ entityKey: buildEstimateDrawingDraftEntityKey(estimate.id), data: fixture.draft });
  const hydrate = vi.spyOn(workingCopy, 'useLocalWorkingCopy');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const context = deferred<WorkbenchContextRead>(), detail = deferred<WorkbenchEstimateRead>();
  const view = renderIntoDocument(<Suspense fallback={null}><ReadHost projectId="proj_1" estimateId={null} requestId={null} initialRead={{ context: context.promise, estimate: detail.promise }} backHref="/staff/projects/proj_1" readOnly /></Suspense>);
  const plan = view.container.querySelector('[data-workbench-nav-id="plan"]') as HTMLButtonElement; act(() => plan.click());
  expect(hydrate).not.toHaveBeenCalled(); expect(viewport).not.toHaveBeenCalled();
  await act(async () => context.resolve({ kind: 'context', context: { kind: 'ready', project: { id: 'proj_1', name: 'Verified fictional project', siteAddress: null }, estimate: { ...fixture.estimate, isActiveDraft: true, selectionSource: 'active_draft' }, request: null, estimateWarning: null, requestWarning: null, providedEstimateId: null, providedRequestId: null } }));
  expect(hydrate).not.toHaveBeenCalled();
  await act(async () => detail.resolve({ kind: 'estimate', estimate }));
  for (let depth = 0; depth < 3; depth += 1) await act(async () => vi.dynamicImportSettled());
  expect(hydrate).toHaveBeenCalled(); expect(viewport).toHaveBeenCalled();
  expect(view.container.querySelectorAll('aside')).toHaveLength(2);
  expect(view.container.querySelector('[data-workbench-nav-id="plan"]')).toBe(plan);
  expect(view.container.querySelector('[data-actual-runtime-viewport]')?.getAttribute('data-mode')).toBe('plan');
  const artifact = viewport.mock.lastCall![0].projectArtifact;
  expect(Object.keys(artifact.objectsById.houses)).toHaveLength(2);
  expect(Object.keys(artifact.objectsById.pergolas)).toHaveLength(2);
  expect(artifact.planLayers.houseCommittedShapes.length).toBeGreaterThan(0);
  // This baked fixture's current pergola diagnostics are preserved, not promoted
  // into committed geometry by the new read-composition boundary.
  expect(artifact.diagnostics.projectPergolaRenderHealth).toHaveLength(2);
  act(() => (view.container.querySelector('[data-workbench-nav-id="sheet"]') as HTMLButtonElement).click());
  expect(viewport.mock.lastCall![0].projectArtifact).toBe(artifact);
  expect((view.container.querySelector('[data-workbench-save-draft]') as HTMLButtonElement).disabled).toBe(true);
  expect(fetch).not.toHaveBeenCalled(); view.unmount();
});
