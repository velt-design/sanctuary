import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectDetailsSidebarClient from './ProjectDetailsSidebar.client';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { PortalProjectDetailsDraft } from '@/lib/localFirst/projectDetails';

const mocks = vi.hoisted(() => ({
  clearWorkingCopy: vi.fn(),
  enqueue: vi.fn(),
  patchProjectDetailsCaches: vi.fn(),
  retry: vi.fn(),
  setWorkingCopy: vi.fn(),
  syncState: {
    entityKey: 'project:details:proj_1',
    status: 'idle' as 'idle' | 'queued' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict',
    pendingCount: 0,
    updatedAt: '2026-07-20T00:00:00.000Z',
    lastError: undefined as string | undefined,
    lastSyncedAt: undefined as string | undefined,
  },
  workingCopy: {
    hydrated: true,
    hasLocalCopy: false,
    value: null as PortalProjectDetailsDraft | null,
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

vi.mock('@/lib/localFirst/useLocalWorkingCopy', () => ({
  useLocalWorkingCopy: (_entityKey: string, initialData: PortalProjectDetailsDraft) => ({
    hydrated: mocks.workingCopy.hydrated,
    hasLocalCopy: mocks.workingCopy.hasLocalCopy,
    value: mocks.workingCopy.value ?? initialData,
    workingCopy: mocks.workingCopy.hasLocalCopy ? { data: mocks.workingCopy.value } : null,
    setWorkingCopy: mocks.setWorkingCopy,
    clearWorkingCopy: mocks.clearWorkingCopy,
  }),
}));

vi.mock('@/lib/localFirst/useEntitySyncState', () => ({
  useAliasedEntitySyncState: () => mocks.syncState,
}));

vi.mock('@/lib/localFirst/queue', () => ({
  enqueueAndProcessLocalFirstMutation: mocks.enqueue,
  retryLocalFirstEntityMutation: mocks.retry,
}));

vi.mock('@/lib/localFirst/projectDetails', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/localFirst/projectDetails')>();
  return {
    ...actual,
    patchProjectDetailsCaches: mocks.patchProjectDetailsCaches,
  };
});

const project = {
  id: 'proj_1',
  name: 'Original project',
  stage: 'new',
  contactId: 'ct_1',
  contactName: 'Taylor',
  contactEmail: 'taylor@example.com',
  contactPhone: '0210000000',
  siteAddress: '1 Example St',
  region: 'North',
  quoteRef: 'Q-1001',
  nextActionDate: '2026-04-03',
} as const;

function click(target: Element | null) {
  if (!target) throw new Error('Missing click target');
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function changeValue(target: HTMLInputElement | null, value: string) {
  if (!target) throw new Error('Missing input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('Missing value setter');
  act(() => {
    setter.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function findButton(container: Element, label: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.trim() === label) ?? null;
}

describe('ProjectDetailsSidebarClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.clearWorkingCopy.mockReset().mockResolvedValue(undefined);
    mocks.enqueue.mockReset().mockResolvedValue({ id: 'queue_1' });
    mocks.patchProjectDetailsCaches.mockReset();
    mocks.retry.mockReset().mockResolvedValue(true);
    mocks.setWorkingCopy.mockReset().mockImplementation(async (draft: PortalProjectDetailsDraft) => {
      mocks.workingCopy.hasLocalCopy = true;
      mocks.workingCopy.value = draft;
    });
    Object.assign(mocks.syncState, {
      status: 'idle',
      pendingCount: 0,
      lastError: undefined,
      lastSyncedAt: undefined,
    });
    mocks.workingCopy.hydrated = true;
    mocks.workingCopy.hasLocalCopy = false;
    mocks.workingCopy.value = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('queues autosaved project details in the user-owned local-first runtime', async () => {
    const rendered = renderIntoDocument(<ProjectDetailsSidebarClient project={project} />);

    click(findButton(rendered.container, 'Edit'));
    changeValue(rendered.container.querySelector('#projectName'), 'Updated project');

    await act(async () => {
      vi.advanceTimersByTime(701);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.patchProjectDetailsCaches).toHaveBeenCalledWith(
      {},
      'host',
      'proj_1',
      expect.objectContaining({ projectName: 'Updated project' }),
      { contactId: 'ct_1' },
    );
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        entityKey: 'project:details:proj_1',
        mutationKey: 'portal.project.details.update',
        payload: expect.objectContaining({
          projectId: 'proj_1',
          draft: expect.objectContaining({ projectName: 'Updated project' }),
          previousDraft: expect.objectContaining({ projectName: 'Original project' }),
        }),
      }),
    );

    rendered.unmount();
  });

  it('leaves edit mode and shows the new value before local queue persistence settles', async () => {
    let releaseWorkingCopy: () => void = () => undefined;
    mocks.setWorkingCopy.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        releaseWorkingCopy = resolve;
      }),
    );
    const rendered = renderIntoDocument(<ProjectDetailsSidebarClient project={project} />);

    click(findButton(rendered.container, 'Edit'));
    changeValue(rendered.container.querySelector('#siteAddress'), '99 Client Road');
    click(findButton(rendered.container, 'Done'));

    expect(rendered.container.querySelector('#siteAddress')).toBeNull();
    expect(rendered.container.textContent).toContain('99 Client Road');
    expect(mocks.enqueue).not.toHaveBeenCalled();

    await act(async () => {
      releaseWorkingCopy();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });

  it('keeps a conflicted draft available for review and explicit retry', async () => {
    mocks.syncState.status = 'conflict';
    mocks.syncState.pendingCount = 1;
    mocks.syncState.lastError = 'Project details are no longer writable.';
    mocks.workingCopy.hasLocalCopy = true;
    mocks.workingCopy.value = {
      contactName: 'Taylor',
      contactEmail: 'taylor@example.com',
      contactPhone: '0210000000',
      projectName: 'Rejected project',
      siteAddress: '1 Example St',
      region: 'North',
      quoteRef: 'Q-1001',
      nextActionDate: '2026-04-03',
    };
    const rendered = renderIntoDocument(<ProjectDetailsSidebarClient project={project} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain('Original project');
    expect(rendered.container.textContent).toContain('Project details are no longer writable.');

    click(findButton(rendered.container, 'Review changes'));
    expect((rendered.container.querySelector('#projectName') as HTMLInputElement | null)?.value).toBe('Rejected project');
    click(findButton(rendered.container, 'Reset'));
    click(findButton(rendered.container, 'Retry now'));

    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.patchProjectDetailsCaches).toHaveBeenCalledWith(
      {},
      'host',
      'proj_1',
      expect.objectContaining({ projectName: 'Rejected project' }),
      { contactId: 'ct_1' },
    );
    expect(mocks.retry).toHaveBeenCalledWith('project:details:proj_1');

    rendered.unmount();
  });

  it('refreshes confirmed details when a new project prop arrives', () => {
    const rendered = renderIntoDocument(<ProjectDetailsSidebarClient project={project} />);

    rendered.rerender(
      <ProjectDetailsSidebarClient
        project={{
          ...project,
          siteAddress: '25 Updated Avenue',
        }}
      />,
    );

    expect(rendered.container.textContent).toContain('25 Updated Avenue');
    rendered.unmount();
  });
});
