import { QueryClient } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EstimateDetail } from '@/lib/estimates/types';
import type { CalculatorInputs } from '@/lib/types/calculator';
import type { Project } from '@/lib/types/project';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { CalculatorDraftPersistence } from './calculatorDraftPersistence';
import { makeDefaultCalculatorInputs } from './calculatorInputs';
import { useCalculatorWorkspaceSession } from './useCalculatorWorkspaceSession';
import CalculatorSessionBoundary from './CalculatorSessionBoundary';
import CalculatorCommandBar from './CalculatorCommandBar';
import FieldTile from './FieldTile';
import { __resetLocalFirstStoreForTests, __setLocalFirstStorageAdapterForTests, ensureLocalFirstStoreReady, registerLocalFirstIdAlias } from '@/lib/localFirst/store';
import { qk } from '@/lib/queries/keys';

type WorkspaceSessionOptions = Parameters<typeof useCalculatorWorkspaceSession>[0];
type WorkspaceSession = ReturnType<typeof useCalculatorWorkspaceSession>;

let latest: WorkspaceSession | null = null;

function session(): WorkspaceSession {
  if (!latest) throw new Error('Workspace session probe has not rendered.');
  return latest;
}

function Probe({ options }: { options: WorkspaceSessionOptions }) {
  latest = useCalculatorWorkspaceSession(options);
  return (
    <CalculatorSessionBoundary ready={latest.draftReady} error={latest.draftLoadError} onRetry={latest.retryDraftLoad}>
      <FieldTile id="length" label="Length" type="number" value={latest.values.modules[0]?.lengthM ?? ''}/>
      <CalculatorCommandBar projectLabel="Fictional project" isEditingDesign={latest.isEditingDesign} activeModuleLabel="Module 1" readinessSummary={{tone:'ready',label:'Ready to save',accessibleLabel:'Ready to save',rootCauseCount:0,blockedCheckCount:0,reviewCount:0}} localDraftStatus={latest.localDraftStatus} saveLabel="Save" saveDisabled={false} onSave={()=>{}}/>
    </CalculatorSessionBoundary>
  );
}

function makePersistence(): CalculatorDraftPersistence {
  return {
    restore: vi.fn().mockResolvedValue(null),
    persist: vi.fn().mockResolvedValue({ sessionStored: true, workingCopyStored: false }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    createdAt: '2026-07-23T00:00:00.000Z',
    projectName: 'Project one',
    quoteRef: 'Q-001',
    ...overrides,
  };
}

function makeEstimate(overrides: Partial<EstimateDetail> = {}): EstimateDetail {
  return {
    id: 'estimate-workspace-test',
    projectId: 'project-1',
    createdAt: '2026-07-23T00:00:00.000Z',
    status: 'draft',
    summary: {},
    versionLabel: 'V1',
    isActiveDraft: true,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
    calculatorSnapshot: { inputs: makeDefaultCalculatorInputs() },
    editability: {
      isLocked: false,
      lockReason: null,
      lockedAt: null,
      lockedByQuoteVersionId: null,
      lockedByQuoteRef: null,
      lockedByQuoteVersionNumber: null,
      hasDraftQuotes: false,
      draftQuoteCount: 0,
    },
    ...overrides,
  };
}

function makeOptions(overrides: Partial<WorkspaceSessionOptions> = {}): WorkspaceSessionOptions {
  return {
    route: {
      projectId: '',
      editEstimateId: '',
      fromEstimateId: '',
      shouldOpenActiveDraft: false,
    },
    activeDraftEstimateMetaId: null,
    hostKey: 'test-host',
    searchParams: new URLSearchParams(),
    router: { replace: vi.fn() },
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    toast: { success: vi.fn(), error: vi.fn() },
    projectLoader: vi.fn().mockResolvedValue(null),
    estimateLoader: vi.fn().mockRejectedValue(new Error('Unexpected estimate load')),
    estimateDuplicator: vi.fn().mockRejectedValue(new Error('Unexpected duplicate')),
    draftPersistence: makePersistence(),
    ...overrides,
  };
}

async function waitUntil(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 5));
    });
  }
  throw lastError;
}

beforeEach(async () => {
  __resetLocalFirstStoreForTests();
  __setLocalFirstStorageAdapterForTests({ get: async () => undefined, set: async () => undefined });
  await ensureLocalFirstStoreReady();
});

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('useCalculatorWorkspaceSession', () => {
  it('keeps defaults and save controls hidden until the selected estimate is hydrated', async () => {
    const pending = deferred<EstimateDetail>();
    const options = makeOptions({
      route: { projectId: '', editEstimateId: 'estimate-loading', fromEstimateId: '', shouldOpenActiveDraft: false },
      estimateLoader: vi.fn().mockReturnValue(pending.promise),
    });
    const rendered = renderIntoDocument(<Probe options={options} />);
    await waitUntil(() => expect(options.estimateLoader).toHaveBeenCalled());
    expect(session().draftReady).toBe(false);
    expect(document.querySelector<HTMLInputElement>('input')?.disabled).toBe(true);
    expect(document.querySelector<HTMLInputElement>('input')?.value).toBe('');
    expect(document.querySelector<HTMLButtonElement>('[data-calculator-command-save]')?.disabled).toBe(true);
    const inputs = makeDefaultCalculatorInputs();
    inputs.modules[0].lengthM = '8.4';
    await act(async () => pending.resolve(makeEstimate({
      id: 'estimate-loading', calculatorSnapshot: { inputs },
    })));
    await waitUntil(() => expect(document.querySelector('input')?.value).toBe('8.4'));
    expect(session().draftReady).toBe(true);
    expect(document.body.textContent).toContain('Save');
    expect(session().localDraftStatus.kind).toBe('idle');
    await act(async () => session().setValues((values) => ({
      ...values, modules: [{ ...values.modules[0], lengthM: '8.5' }],
    })));
    await waitUntil(() => expect(session().localDraftStatus.kind).toBe('saved'));
    rendered.unmount();
  });


  it('keeps edited inputs and module selection while pending Save changes the workspace controls', async () => {
    const inputs = makeDefaultCalculatorInputs();
    inputs.modules[0].lengthM = '6.2';
    inputs.modules.push({ ...inputs.modules[0], lengthM: '4' });
    const estimate = makeEstimate({ id: 'estimate-pending-save', versionLabel: 'V2', calculatorSnapshot: { inputs } });
    const workspace = {
      kind: 'project' as const, host: 'test-host', projectId: 'project-1', editEstimateId: estimate.id,
      designNavigation: { value: estimate.id, stateLabel: 'Editing', options: [], onChange: vi.fn(), disabled: false },
      onEstimateSaved: vi.fn(), onOpenProject: vi.fn(),
    };
    const options = makeOptions({
      workspace,
      route: { projectId: '', editEstimateId: estimate.id, fromEstimateId: '', shouldOpenActiveDraft: false },
      estimateLoader: vi.fn().mockResolvedValue(estimate),
    });
    options.queryClient.setQueryData(qk.estimates.detail('test-host', estimate.id), estimate);
    const rendered = renderIntoDocument(<Probe options={options} />);
    await waitUntil(() => expect(session().draftReady).toBe(true));
    await act(async () => {
      session().setValues((values) => ({ ...values, modules: [{ ...values.modules[0], lengthM: '6.3' }, values.modules[1]] }));
      session().setActiveModuleIndex(1);
    });
    const saveAcknowledgement = deferred<void>();
    const savingOptions = { ...options, workspace: { ...workspace, designNavigation: { ...workspace.designNavigation, disabled: true } } };
    await act(async () => rendered.rerender(<Probe options={savingOptions} />));
    expect(session().draftReady).toBe(true);
    expect(session().values.modules[0].lengthM).toBe('6.3');
    expect(session().activeModuleIndex).toBe(1);
    expect((session().loadedEstimateDetail?.calculatorSnapshot?.inputs as CalculatorInputs).modules[0].lengthM).toBe('6.2');
    const completing = saveAcknowledgement.promise.then(() => {
      session().setLoadedEstimateDetail({ ...estimate, calculatorSnapshot: { inputs: session().values } });
      rendered.rerender(<Probe options={{ ...options, workspace: { ...workspace } }} />);
    });
    await act(async () => { saveAcknowledgement.resolve(); await completing; });
    expect(session().values.modules[0].lengthM).toBe('6.3');
    expect(session().activeModuleIndex).toBe(1);
    expect((session().loadedEstimateDetail?.calculatorSnapshot?.inputs as CalculatorInputs).modules[0].lengthM).toBe('6.3');
    rendered.unmount();
  });

  it('carries newer unsaved edits and module selection across acknowledgement of a temporary ID', async () => {
    const localId = 'local-estimate:workspace-promotion';
    const canonicalId = 'estimate-promoted';
    const inputs = makeDefaultCalculatorInputs();
    inputs.modules[0].lengthM = '6.2';
    inputs.modules.push({ ...inputs.modules[0], lengthM: '4' });
    const local = makeEstimate({ id: localId, versionLabel: 'V2', calculatorSnapshot: { inputs } });
    const canonical = { ...local, id: canonicalId };
    const options = makeOptions({
      route: { projectId: '', editEstimateId: localId, fromEstimateId: '', shouldOpenActiveDraft: false },
      estimateLoader: vi.fn().mockResolvedValue(canonical),
    });
    options.queryClient.setQueryData(qk.estimates.detail('test-host', localId), local);
    const rendered = renderIntoDocument(<Probe options={options} />);
    await waitUntil(() => expect(session().draftReady).toBe(true));
    await act(async () => {
      session().setValues((values) => ({ ...values, modules: [{ ...values.modules[0], lengthM: '6.3' }, values.modules[1]] }));
      session().setActiveModuleIndex(1);
    });
    await act(async () => {
      options.queryClient.setQueryData(qk.estimates.detail('test-host', canonicalId), canonical);
      await registerLocalFirstIdAlias(localId, canonicalId);
      rendered.rerender(<Probe options={{ ...options, route: { ...options.route, editEstimateId: canonicalId } }} />);
    });
    await waitUntil(() => expect(session().draftReady).toBe(true));
    expect(session().activeEditEstimateId).toBe(canonicalId);
    expect(session().values.modules[0].lengthM).toBe('6.3');
    expect(session().activeModuleIndex).toBe(1);
    expect(session().loadedEstimateDetail?.id).toBe(canonicalId);
    expect((session().loadedEstimateDetail?.calculatorSnapshot?.inputs as CalculatorInputs).modules[0].lengthM).toBe('6.2');
    expect(session().localDraftStatus.kind).toBe('saved');
    rendered.unmount();
  });

  it('keeps a failed load closed and retries without presenting the default estimate', async () => {
    const estimateLoader = vi.fn().mockRejectedValueOnce(new Error('Connection interrupted'))
      .mockResolvedValueOnce(makeEstimate({ id: 'estimate-retry' }));
    const options = makeOptions({
      route: { projectId: '', editEstimateId: 'estimate-retry', fromEstimateId: '', shouldOpenActiveDraft: false },
      estimateLoader,
    });
    const rendered = renderIntoDocument(<Probe options={options} />);
    await waitUntil(() => expect(document.body.textContent).toContain('Connection interrupted'));
    expect(document.querySelector<HTMLInputElement>('input')?.disabled).toBe(true);
    expect(document.querySelector<HTMLInputElement>('input')?.value).toBe('');
    const retry = Array.from(document.querySelectorAll('button')).find((button) => /retry/i.test(button.textContent ?? ''));
    expect(retry).toBeTruthy();
    await act(async () => retry!.click());
    await waitUntil(() => expect(session().draftReady).toBe(true));
    expect(estimateLoader).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).not.toContain('Connection interrupted');
    rendered.unmount();
  });

  it('hydrates selected project metadata into a fresh calculator draft', async () => {
    const project = makeProject();
    const projectLoader = vi.fn().mockResolvedValue(project);
    const options = makeOptions({
      route: {
        projectId: project.id,
        editEstimateId: '',
        fromEstimateId: '',
        shouldOpenActiveDraft: false,
      },
      projectLoader,
    });
    const rendered = renderIntoDocument(<Probe options={options} />);

    await waitUntil(() => {
      expect(session().project).toEqual(project);
      expect(session().values).toMatchObject({ projectName: 'Project one', quoteRef: 'Q-001' });
    });
    expect(projectLoader).toHaveBeenCalledWith('project-1');
    expect(session().projectError).toBeNull();
    rendered.unmount();
  });

  it('normalizes a duplicated estimate into the external draft session', async () => {
    const duplicated: CalculatorInputs = {
      ...makeDefaultCalculatorInputs(),
      modules: [{ ...makeDefaultCalculatorInputs().modules[0], lengthM: '9' }],
    };
    const estimateDuplicator = vi.fn().mockResolvedValue(duplicated);
    const toast = { success: vi.fn(), error: vi.fn() };
    const options = makeOptions({
      route: {
        projectId: '',
        editEstimateId: '',
        fromEstimateId: 'estimate-source',
        shouldOpenActiveDraft: false,
      },
      estimateDuplicator,
      toast,
    });
    const rendered = renderIntoDocument(<Probe options={options} />);

    await waitUntil(() => {
      expect(session().values.modules[0].lengthM).toBe('9');
      expect(session().draftNotice).toBe('Draft design started from estimate-source');
    });
    expect(estimateDuplicator).toHaveBeenCalledWith('estimate-source');
    expect(toast.success).toHaveBeenCalledWith('Draft design started from estimate-source');
    rendered.unmount();
  });

  it('blocks a locked estimate and routes standalone users back to its project', async () => {
    const estimate = makeEstimate({
      id: 'estimate-workspace-test-locked',
      editability: {
        ...makeEstimate().editability,
        isLocked: true,
        lockReason: 'quote_sent',
      },
    });
    const router = { replace: vi.fn() };
    const toast = { success: vi.fn(), error: vi.fn() };
    const options = makeOptions({
      route: {
        projectId: 'project-1',
        editEstimateId: estimate.id,
        fromEstimateId: '',
        shouldOpenActiveDraft: false,
      },
      router,
      toast,
      projectLoader: vi.fn().mockResolvedValue(makeProject()),
      estimateLoader: vi.fn().mockResolvedValue(estimate),
    });
    const rendered = renderIntoDocument(<Probe options={options} />);

    await waitUntil(() => {
      expect(session().loadedEstimateDetail).toEqual(estimate);
      expect(session().draftNotice).toBe('Design V1 is locked and can no longer be edited.');
    });
    expect(toast.error).toHaveBeenCalledWith('Design V1 is locked and can no longer be edited.');
    expect(router.replace).toHaveBeenCalledWith(
      '/staff/projects/project-1?tab=estimates&estimateId=estimate-workspace-test-locked',
    );
    rendered.unmount();
  });

  it('clears the edit session when browser navigation removes the estimate id', async () => {
    const estimate = makeEstimate();
    const baseOptions = makeOptions({
      workspace: {
        kind: 'project',
        host: 'test-host',
        projectId: 'project-1',
        editEstimateId: estimate.id,
        designNavigation: { value: estimate.id, stateLabel: 'Editing', options: [], onChange: vi.fn() },
        onEstimateSaved: vi.fn(),
        onOpenProject: vi.fn(),
      },
      route: {
        projectId: 'project-1',
        editEstimateId: estimate.id,
        fromEstimateId: '',
        shouldOpenActiveDraft: false,
      },
      projectLoader: vi.fn().mockResolvedValue(makeProject()),
      estimateLoader: vi.fn().mockResolvedValue(estimate),
    });
    const rendered = renderIntoDocument(<Probe options={baseOptions} />);
    await waitUntil(() => {
      expect(session().activeEditEstimateId).toBe(estimate.id);
      expect(session().loadedEstimateDetail?.id).toBe(estimate.id);
    });

    await act(async () => {
      rendered.rerender(<Probe options={{
        ...baseOptions,
        route: { ...baseOptions.route, editEstimateId: '' },
        workspace: { ...baseOptions.workspace!, editEstimateId: undefined },
      }} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });
    expect(session().activeEditEstimateId).toBe('');
    await act(async () => {
      rendered.unmount();
      await Promise.resolve();
    });
  });

  it('ignores a slow project load after a newer project is selected', async () => {
    const first = deferred<Project | null>();
    const second = deferred<Project | null>();
    const projectLoader = vi.fn((id: string) => id === 'project-1' ? first.promise : second.promise);
    const baseOptions = makeOptions({
      route: { projectId: 'project-1', editEstimateId: '', fromEstimateId: '', shouldOpenActiveDraft: false },
      projectLoader,
    });
    const rendered = renderIntoDocument(<Probe options={baseOptions} />);
    rendered.rerender(<Probe options={{
      ...baseOptions,
      route: { ...baseOptions.route, projectId: 'project-2' },
    }} />);

    await act(async () => {
      second.resolve(makeProject({ id: 'project-2', projectName: 'Project two' }));
      await Promise.resolve();
      first.resolve(makeProject({ id: 'project-1', projectName: 'Stale project one' }));
      await Promise.resolve();
    });
    await waitUntil(() => expect(session().project?.id).toBe('project-2'));
    expect(session().project?.projectName).toBe('Project two');
    expect(session().values.projectName).toBe('Project two');
    rendered.unmount();
  });

  it('ignores a slow estimate load after a newer estimate is selected', async () => {
    const first = deferred<EstimateDetail>();
    const second = deferred<EstimateDetail>();
    const estimateLoader = vi.fn((id: string) => id === 'estimate-1' ? first.promise : second.promise);
    const baseOptions = makeOptions({
      workspace: {
        kind: 'project',
        host: 'test-host',
        projectId: 'project-1',
        editEstimateId: 'estimate-1',
        designNavigation: { value: 'estimate-1', stateLabel: 'Editing', options: [], onChange: vi.fn() },
        onEstimateSaved: vi.fn(),
        onOpenProject: vi.fn(),
      },
      route: { projectId: '', editEstimateId: 'estimate-1', fromEstimateId: '', shouldOpenActiveDraft: false },
      estimateLoader,
    });
    const rendered = renderIntoDocument(<Probe options={baseOptions} />);
    rendered.rerender(<Probe options={{
      ...baseOptions,
      route: { ...baseOptions.route, editEstimateId: 'estimate-2' },
      workspace: {
        ...baseOptions.workspace!,
        editEstimateId: 'estimate-2',
        designNavigation: { ...baseOptions.workspace!.designNavigation, value: 'estimate-2' },
      },
    }} />);

    const estimateTwo = makeEstimate({ id: 'estimate-2', versionLabel: 'V2' });
    await act(async () => {
      second.resolve(estimateTwo);
      await Promise.resolve();
      first.resolve(makeEstimate({ id: 'estimate-1', versionLabel: 'V1' }));
      await Promise.resolve();
    });
    await waitUntil(() => expect(session().loadedEstimateDetail?.id).toBe('estimate-2'));
    expect(session().draftNotice).toBe('Editing design V2');
    rendered.unmount();
  });
});
