import { act, Profiler, StrictMode, useLayoutEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import type { EstimateDetail } from '@/lib/estimates/types';
import ReadHost from './DesignWorkbenchReadHost';
import type { WorkbenchContextRead, WorkbenchEstimateRead, WorkbenchPageRead } from './workbenchPageRead';
const { mounted, saveCommand, refresh } = vi.hoisted(() => ({ mounted: vi.fn(), saveCommand: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('./DesignWorkbenchEstimateClient', () => ({ default: function Runtime(props: any) {
  mounted(props);
  useLayoutEffect(() => { props.externalChrome.onSaveActionChange({ label: 'Save workbench draft', statusText: 'Unsaved changes', disabled: false, onSave: saveCommand }); return () => props.externalChrome.onSaveActionChange(null); }, [props.externalChrome.onSaveActionChange]);
  return <section data-runtime data-mode={props.externalChrome.viewportMode} data-read-only={String(props.readOnly)}>{props.projectName} {props.estimate.versionLabel}</section>;
} }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((accept) => { resolve = accept; }); return { promise, resolve }; }
function sources() { const context = deferred<WorkbenchContextRead>(), estimate = deferred<WorkbenchEstimateRead>(); return { context, estimate, read: { context: context.promise, estimate: estimate.promise } }; }
function context(projectId = 'proj_1', id = 'est_1'): WorkbenchContextRead { return { kind: 'context', context: { kind: 'ready', project: { id: projectId, name: `Project ${projectId}`, siteAddress: null }, estimate: { id, versionLabel: 'V1', status: 'draft', createdAt: '2026-10-01', isActiveDraft: true, selectionSource: 'query' }, request: null, estimateWarning: null, requestWarning: null, providedEstimateId: id, providedRequestId: null } }; }
function detail(projectId = 'proj_1', id = 'est_1'): EstimateDetail { return { projectId, id, versionLabel: 'V1', editability: { isLocked: false } } as EstimateDetail; }
function tree(read: WorkbenchPageRead, projectId = 'proj_1') { return <StrictMode><ReadHost projectId={projectId} estimateId={null} requestId={null} initialRead={read} backHref={`/staff/projects/${projectId}`} /></StrictMode>; }
afterEach(() => { mounted.mockClear(); saveCommand.mockClear(); refresh.mockClear(); });

describe('actual Workbench read frame', () => {
  it('keeps the actual mode/Save/Back nodes before context and complete estimate, without mounting a record runtime', async () => {
    const source = sources();
    const voidThenable = { then(resolve: (value: WorkbenchContextRead) => void) { void source.context.promise.then(resolve); } } as unknown as Promise<WorkbenchContextRead>;
    const read = { context: voidThenable, estimate: source.read.estimate };
    const view = renderIntoDocument(tree(read));
    const plan = view.container.querySelector('[data-workbench-nav-id="plan"]') as HTMLButtonElement;
    const save = view.container.querySelector('[data-workbench-save-draft]') as HTMLButtonElement;
    const back = view.container.querySelector('a');
    expect(save.disabled).toBe(true); expect(mounted).not.toHaveBeenCalled();
    act(() => plan.click());
    await act(async () => source.context.resolve(context()));
    expect(view.container.textContent).toContain('Project proj_1'); expect(mounted).not.toHaveBeenCalled();
    await act(async () => source.estimate.resolve({ kind: 'estimate', estimate: detail() }));
    expect(view.container.querySelector('[data-workbench-nav-id="plan"]')).toBe(plan);
    expect(view.container.querySelector('a')).toBe(back); expect(view.container.querySelector('[data-workbench-save-draft]')).toBe(save);
    expect(view.container.querySelector('[data-runtime]')?.getAttribute('data-mode')).toBe('plan');
    expect(save.disabled).toBe(false); view.unmount();
  });

  it('makes cached refresh read-only from its first commit, clears later denial and recovers without an old Save callback', async () => {
    const source = sources(), commits: boolean[] = [];
    const element = (read: WorkbenchPageRead) => <Profiler id="frame" onRender={() => commits.push((document.querySelector('[data-workbench-save-draft]') as HTMLButtonElement)?.disabled)}>{tree(read)}</Profiler>;
    const view = renderIntoDocument(element(source.read));
    await act(async () => { source.context.resolve(context()); source.estimate.resolve({ kind: 'estimate', estimate: detail() }); });
    const save = view.container.querySelector('[data-workbench-save-draft]') as HTMLButtonElement;
    const runtime = view.container.querySelector('[data-runtime]');
    const next = sources(); commits.length = 0; view.rerender(element(next.read));
    expect(commits[0]).toBe(true); expect(view.container.querySelector('[data-runtime]')).toBe(runtime);
    expect(runtime?.getAttribute('data-read-only')).toBe('true'); act(() => save.click()); expect(saveCommand).not.toHaveBeenCalled();
    await act(async () => { next.context.resolve({ kind: 'error', accessEnded: true, message: 'Access ended' }); next.estimate.resolve({ kind: 'estimate', estimate: null }); });
    expect(view.container.querySelector('[data-runtime]')).toBeNull(); expect(view.container.textContent).not.toContain('Project proj_1');
    act(() => Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent === 'Retry workbench')!.click()); expect(refresh).toHaveBeenCalledOnce();
    const recovered = sources(); view.rerender(element(recovered.read)); expect(save.disabled).toBe(true);
    await act(async () => { recovered.context.resolve(context()); recovered.estimate.resolve({ kind: 'estimate', estimate: detail() }); });
    expect(view.container.querySelector('[data-workbench-save-draft]')).toBe(save); expect(save.disabled).toBe(false); view.unmount();
  });

  it('does not leak labels/runtime through a rapid A/B read or confirmed no-estimate outcome', async () => {
    const old = sources(), next = sources();
    const view = renderIntoDocument(tree(old.read)); view.rerender(tree(next.read, 'proj_2'));
    await act(async () => { old.context.resolve(context()); old.estimate.resolve({ kind: 'estimate', estimate: detail() }); });
    expect(mounted).not.toHaveBeenCalled(); expect(view.container.textContent).not.toContain('Project proj_1');
    await act(async () => { next.context.resolve({ kind: 'context', context: { kind: 'no_estimate', project: { id: 'proj_2', name: 'Project two', siteAddress: null }, providedEstimateId: null, providedRequestId: null } }); next.estimate.resolve({ kind: 'estimate', estimate: null }); });
    expect(view.container.textContent).toContain('No usable estimate'); expect(mounted).not.toHaveBeenCalled(); view.unmount();
  });

  it('clears genuine context labels and request identity when a later detail read denies previously ready access', async () => {
    const verified = context();
    if (verified.kind !== 'context' || verified.context.kind !== 'ready') throw new Error('Expected ready test context');
    verified.context.request = { id: 'dpr_private', requestVersion: 1, status: 'OPEN', priorityTier: 'TIER_2', estimateId: 'est_1', estimateVersionLabel: 'V1', updatedAt: '2026-10-22', selectionSource: 'active' };
    const source = sources(), next = sources();
    const view = renderIntoDocument(tree(source.read));
    await act(async () => { source.context.resolve(verified); source.estimate.resolve({ kind: 'estimate', estimate: detail() }); });
    const plan = view.container.querySelector('[data-workbench-nav-id="plan"]');
    const back = view.container.querySelector('a');
    expect(view.container.textContent).toContain('Project proj_1');
    expect(view.container.querySelector('main')?.getAttribute('data-request-id')).toBe('dpr_private');
    view.rerender(tree(next.read));
    await act(async () => next.context.resolve(verified));
    expect(view.container.querySelector('[data-runtime]')).not.toBeNull();
    await act(async () => next.estimate.resolve({ kind: 'error', accessEnded: true, message: 'Selected design access ended' }));
    expect(view.container.querySelector('[data-runtime]')).toBeNull();
    expect(view.container.textContent).not.toContain('Project proj_1');
    expect(view.container.textContent).toContain('Project unavailable');
    expect(view.container.querySelector('main')?.getAttribute('data-request-id')).toBeNull();
    expect(view.container.querySelector('main')?.getAttribute('data-estimate-id')).toBeNull();
    expect(view.container.querySelector('[data-workbench-nav-id="plan"]')).toBe(plan);
    expect(view.container.querySelector('a')).toBe(back);
    expect((view.container.querySelector('[data-workbench-save-draft]') as HTMLButtonElement).disabled).toBe(true);
    expect(saveCommand).not.toHaveBeenCalled(); view.unmount();
  });
});
