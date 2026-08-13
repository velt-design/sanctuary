import { QueryClient } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EstimateDetail } from '@/lib/estimates/types';
import type { CalculatorInputs } from '@/lib/types/calculator';
import type { Project } from '@/lib/types/project';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { CalculatorDraftPersistence } from './calculatorDraftPersistence';
import { makeDefaultCalculatorInputs } from './calculatorInputs';
import { useCalculatorWorkspaceSession } from './useCalculatorWorkspaceSession';

type WorkspaceSessionOptions = Parameters<typeof useCalculatorWorkspaceSession>[0];
type WorkspaceSession = ReturnType<typeof useCalculatorWorkspaceSession>;

let latest: WorkspaceSession | null = null;

function session(): WorkspaceSession {
  if (!latest) throw new Error('Workspace session probe has not rendered.');
  return latest;
}

function Probe({ options }: { options: WorkspaceSessionOptions }) {
  latest = useCalculatorWorkspaceSession(options);
  return null;
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

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('useCalculatorWorkspaceSession', () => {
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
