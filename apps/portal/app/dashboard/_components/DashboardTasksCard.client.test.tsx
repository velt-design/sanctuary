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

  it('reconciles refreshed tasks without resetting the task being saved', async () => {
    let resolveSave: ((response: Response) => void) | null = null;
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(new Promise((resolve) => {
      resolveSave = resolve;
    }));
    const callClient = {
      id: 'task_1',
      title: 'Call client',
      completedAt: null,
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z',
    };
    const orderRoofing = {
      id: 'task_2',
      title: 'Order roofing',
      completedAt: null,
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z',
    };
    const rendered = renderIntoDocument(<DashboardTasksCard initialTasks={[callClient]} />);
    const checkbox = rendered.container.querySelector('input[type="checkbox"]') as HTMLInputElement;

    act(() => checkbox.click());
    rendered.rerender(<DashboardTasksCard initialTasks={[callClient, orderRoofing]} />);

    expect(rendered.container.querySelector('li[data-complete="true"]')?.textContent).toContain('Call client');
    expect(rendered.container.textContent).toContain('Order roofing');

    await act(async () => {
      resolveSave?.(Response.json({ task: { ...callClient, completedAt: '2026-05-30T01:00:00.000Z' } }));
      await Promise.resolve();
    });
    expect(rendered.container.querySelector('li[data-complete="true"]')?.textContent).toContain('Call client');
    rendered.unmount();
  });

  it('rolls back only the failed task when task saves overlap', async () => {
    const pending: Array<(response: Response) => void> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const tasks = [
      { id: 'task_1', title: 'Call client', completedAt: null, createdAt: '2026-05-30T00:00:00.000Z', updatedAt: '2026-05-30T00:00:00.000Z' },
      { id: 'task_2', title: 'Order roofing', completedAt: null, createdAt: '2026-05-30T00:00:00.000Z', updatedAt: '2026-05-30T00:00:00.000Z' },
    ];
    const rendered = renderIntoDocument(<DashboardTasksCard initialTasks={tasks} />);
    const checkboxes = Array.from(rendered.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

    act(() => {
      checkboxes[0]?.click();
      checkboxes[1]?.click();
    });
    await act(async () => {
      pending[1]?.(Response.json({ task: { ...tasks[1], completedAt: '2026-05-30T02:00:00.000Z' } }));
      await Promise.resolve();
      pending[0]?.(Response.json({ error: 'failed' }, { status: 500 }));
      await Promise.resolve();
    });

    const savedCheckboxes = Array.from(rendered.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(savedCheckboxes[0]?.checked).toBe(false);
    expect(savedCheckboxes[1]?.checked).toBe(true);
    rendered.unmount();
  });
});
