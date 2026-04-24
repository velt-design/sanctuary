import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectTasksSidebarClient from './ProjectTasksSidebar.client';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import { renderIntoDocument } from '../../../../../test/reactHarness';

const apiJsonMock = vi.fn();
const invalidateProjectReadCachesMock = vi.fn();
const patchProjectTasksSnapshotMock = vi.fn();

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
});
