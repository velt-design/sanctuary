import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import DashboardTasksCard from './DashboardTasksCard.client';

describe('DashboardTasksCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('crosses out a task when checked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          task: {
            id: 'task_1',
            title: 'Call client',
            completedAt: '2026-05-30T00:00:00.000Z',
            createdAt: '2026-05-30T00:00:00.000Z',
            updatedAt: '2026-05-30T00:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const rendered = renderIntoDocument(
      <DashboardTasksCard
        initialTasks={[
          {
            id: 'task_1',
            title: 'Call client',
            completedAt: null,
            createdAt: '2026-05-30T00:00:00.000Z',
            updatedAt: '2026-05-30T00:00:00.000Z',
          },
        ]}
      />,
    );

    const checkbox = rendered.container.querySelector('input[type="checkbox"]');
    if (!(checkbox instanceof HTMLInputElement)) throw new Error('Task checkbox not found.');

    await act(async () => {
      checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/dashboard/tasks/task_1', expect.objectContaining({ method: 'PATCH' }));
    expect(
      Array.from(rendered.container.querySelectorAll('li')).some((item) =>
        String(item.className).includes('taskBubbleDone'),
      ),
    ).toBe(true);

    rendered.unmount();
  });
});
