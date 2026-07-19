import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectTasksSidebarClient from './ProjectTasksSidebar.client';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import { renderIntoDocument } from '../../../../../test/reactHarness';

const apiJsonMock = vi.fn();
const invalidateProjectReadCachesMock = vi.fn();
const patchProjectTasksSnapshotMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

vi.mock('@/lib/repo/apiClient', () => ({
  apiJson: (...args: unknown[]) => apiJsonMock(...args),
}));

vi.mock('@/lib/queries/projectCache', () => ({
  invalidateProjectReadCaches: (...args: unknown[]) => invalidateProjectReadCachesMock(...args),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    info: vi.fn(),
  }),
}));

vi.mock('@/lib/localFirst/portalEntities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/localFirst/portalEntities')>();
  return {
    ...actual,
    patchProjectTasksSnapshot: (...args: unknown[]) => patchProjectTasksSnapshotMock(...args),
  };
});

const tasks: ProjectPageSnapshot['tasks'] = {
  stage: 'new',
  items: [
    {
      key: 'confirm_schedule',
      label: 'Confirm schedule',
      kind: 'manual',
      isDone: false,
      isManualDone: false,
    },
  ],
};

const concurrentTasks: ProjectPageSnapshot['tasks'] = {
  stage: 'scheduled',
  items: [
    { key: 'order_materials', label: 'First manual', kind: 'manual', isDone: false, isManualDone: false },
    { key: 'roofing_ordered', label: 'Second manual', kind: 'manual', isDone: false, isManualDone: false },
    { key: 'job_complete', label: 'Remaining task', kind: 'manual', isDone: false, isManualDone: false },
  ],
};

function click(target: Element | null) {
  if (!target) throw new Error('Missing click target');
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('ProjectTasksSidebarClient', () => {
  beforeEach(() => {
    apiJsonMock.mockReset();
    invalidateProjectReadCachesMock.mockReset();
    patchProjectTasksSnapshotMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    apiJsonMock.mockResolvedValue({ ok: true });
    invalidateProjectReadCachesMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('persists manual task toggles directly through the API', async () => {
    const rendered = renderIntoDocument(<ProjectTasksSidebarClient projectId="proj_1" tasks={tasks} />);

    click(rendered.container.querySelector('input[type="checkbox"]'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(apiJsonMock).toHaveBeenCalledWith(
      '/api/projects/proj_1/tasks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ taskKey: 'confirm_schedule', completed: true }),
      }),
    );
    expect(invalidateProjectReadCachesMock).toHaveBeenCalledWith({}, 'host', 'proj_1', {
      includeProjectDetail: false,
      includeProjectsList: false,
    });

    rendered.unmount();
  });

  it('reverts the optimistic state when the direct save fails', async () => {
    apiJsonMock.mockRejectedValueOnce(new Error('Task save failed'));
    const rendered = renderIntoDocument(<ProjectTasksSidebarClient projectId="proj_1" tasks={tasks} />);

    click(rendered.container.querySelector('input[type="checkbox"]'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain('Task save failed');
    expect(patchProjectTasksSnapshotMock).toHaveBeenLastCalledWith({}, 'host', 'proj_1', tasks.items);

    rendered.unmount();
  });

  it('rolls back only the failed task when separate task saves overlap', async () => {
    let rejectFirst: (error: Error) => void = () => undefined;
    let resolveSecond: (value: { ok: boolean }) => void = () => undefined;
    apiJsonMock.mockImplementation((_path: string, init: { body?: string }) => {
      const taskKey = JSON.parse(init.body ?? '{}').taskKey;
      if (taskKey === 'order_materials') {
        return new Promise((_resolve, reject) => {
          rejectFirst = reject;
        });
      }
      return new Promise((resolve) => {
        resolveSecond = resolve;
      });
    });
    const rendered = renderIntoDocument(
      <ProjectTasksSidebarClient projectId="proj_1" tasks={concurrentTasks} />,
    );
    const checkboxes = rendered.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

    click(checkboxes[0]);
    click(checkboxes[1]);
    expect(checkboxes[0]?.checked).toBe(true);
    expect(checkboxes[1]?.checked).toBe(true);

    await act(async () => {
      resolveSecond({ ok: true });
      await Promise.resolve();
      rejectFirst(new Error('First task failed'));
      await Promise.resolve();
      await Promise.resolve();
    });

    const settledCheckboxes = rendered.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(settledCheckboxes[0]?.checked).toBe(false);
    expect(settledCheckboxes[1]?.checked).toBe(true);
    expect(rendered.container.textContent).toContain('First task failed');
    expect(patchProjectTasksSnapshotMock).toHaveBeenLastCalledWith(
      {},
      'host',
      'proj_1',
      expect.arrayContaining([
        expect.objectContaining({ key: 'order_materials', isDone: false }),
        expect.objectContaining({ key: 'roofing_ordered', isDone: true }),
      ]),
    );

    rendered.unmount();
  });

  it('offers an explicit retry after rolling back a rejected task', async () => {
    apiJsonMock
      .mockRejectedValueOnce(new Error('Task save failed'))
      .mockResolvedValueOnce({ ok: true });
    const rendered = renderIntoDocument(<ProjectTasksSidebarClient projectId="proj_1" tasks={tasks} />);

    click(rendered.container.querySelector('input[type="checkbox"]'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((rendered.container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);

    click(rendered.container.querySelector('button[aria-label="Retry Confirm schedule"]'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiJsonMock).toHaveBeenCalledTimes(2);
    expect((rendered.container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);
    expect(rendered.container.textContent).not.toContain('Task save failed');

    rendered.unmount();
  });

  it('renders a single ordered list with no To do / Completed tabs', () => {
    const rendered = renderIntoDocument(
      <ProjectTasksSidebarClient
        projectId="proj_1"
        tasks={{
          stage: 'site_visit',
          items: [
            { key: 'book_site_visit', label: 'Book site visit', kind: 'action', isDone: true },
            { key: 'generate_costing', label: 'Generate costing', kind: 'action', isDone: false, isLocked: true },
            { key: 'upload_photos_site_visit', label: 'Upload photos', kind: 'manual', isDone: false, isLocked: true },
          ],
        }}
      />,
    );

    const tablist = rendered.container.querySelector('[role="tablist"]');
    expect(tablist).toBeNull();

    expect(rendered.container.textContent).toContain('Book site visit');
    expect(rendered.container.textContent).toContain('Done');
    expect(rendered.container.textContent).toContain('Generate costing');
    expect(rendered.container.textContent).toContain('Upload photos');
    expect(rendered.container.textContent).toContain('Pending');

    rendered.unmount();
  });

  it('does not render a checkbox or CTA for a locked manual task', () => {
    const rendered = renderIntoDocument(
      <ProjectTasksSidebarClient
        projectId="proj_1"
        tasks={{
          stage: 'site_visit',
          items: [
            { key: 'upload_photos_site_visit', label: 'Upload photos', kind: 'manual', isDone: false, isLocked: true },
          ],
        }}
      />,
    );

    expect(rendered.container.querySelector('input[type="checkbox"]')).toBeNull();
    rendered.unmount();
  });

  it('fires a stage-move toast when the API reports stageMoved', async () => {
    apiJsonMock.mockResolvedValueOnce({
      ok: true,
      taskKey: 'confirm_schedule',
      completed: true,
      stageMoved: { fromStage: 'DEPOSIT', toStage: 'SCHEDULED' },
    });

    const rendered = renderIntoDocument(
      <ProjectTasksSidebarClient
        projectId="proj_1"
        tasks={{
          stage: 'deposit',
          items: [
            { key: 'confirm_schedule', label: 'Confirm schedule', kind: 'manual', isDone: false, isManualDone: false },
          ],
        }}
      />,
    );

    click(rendered.container.querySelector('input[type="checkbox"]'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Schedule confirmed. Project moved to Scheduled.');

    rendered.unmount();
  });

  it('does not open the stage-complete modal when an auto-advance task fires', async () => {
    apiJsonMock.mockResolvedValueOnce({
      ok: true,
      taskKey: 'confirm_schedule',
      completed: true,
      stageMoved: { fromStage: 'DEPOSIT', toStage: 'SCHEDULED' },
    });

    const rendered = renderIntoDocument(
      <ProjectTasksSidebarClient
        projectId="proj_1"
        tasks={{
          stage: 'deposit',
          items: [
            { key: 'confirm_schedule', label: 'Confirm schedule', kind: 'manual', isDone: false, isManualDone: false },
          ],
        }}
      />,
    );

    click(rendered.container.querySelector('input[type="checkbox"]'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).not.toContain('Stage complete');
    rendered.unmount();
  });
});
