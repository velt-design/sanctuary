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
    expect(rendered.container.querySelector('li[data-complete="true"]')).not.toBeNull();

    rendered.unmount();
  });

  it('keeps the task card and composer mounted while initial tasks load', () => {
    const task = {
      id: 'task_2',
      title: 'Confirm delivery',
      completedAt: null,
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z',
    };
    const rendered = renderIntoDocument(<DashboardTasksCard loading />);

    expect(rendered.container.querySelector('[aria-label="My Tasks"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="New dashboard task"]')?.hasAttribute('disabled')).toBe(true);
    expect(rendered.container.querySelector('[data-dashboard-loading-rows="true"]')).not.toBeNull();

    rendered.rerender(<DashboardTasksCard initialTasks={[task]} />);

    expect(rendered.container.querySelector('[aria-label="My Tasks"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-dashboard-loading-rows="true"]')).toBeNull();
    expect(rendered.container.textContent).toContain('Confirm delivery');
    rendered.unmount();
  });
});
