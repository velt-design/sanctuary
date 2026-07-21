import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '@/lib/dashboard/types';
import { renderIntoDocument } from '../../../../test/reactHarness';
import DashboardClient from './DashboardClient';

const retry = vi.fn();
const useDashboardData = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined }),
  queryOptions: (options: unknown) => options,
}));

vi.mock('./useDashboardData', () => ({
  useDashboardData: (...args: unknown[]) => useDashboardData(...args),
}));

vi.mock('./DashboardView', () => ({
  default: ({ data, state, onRetry }: { data: DashboardData; state: string; onRetry: () => void }) => (
    <main data-dashboard-state={state} data-project-count={data.kpis.newLeads}>
      <h1>Dashboard</h1>
      <button type="button" onClick={onRetry}>Retry saved dashboard</button>
    </main>
  ),
}));

const data: DashboardData = {
  updatedAtIso: '2026-04-02T00:00:00.000Z',
  kpis: { actionsDue: 4, newLeads: 2, quotesToSend: 1, installsThisWeek: 3 },
  attention: [],
  workQueue: [],
  schedule: {
    startingSoon: [],
    crewAvailability: [],
    hrefBoard: '/staff/schedule?view=board',
    hrefGantt: '/staff/schedule?view=gantt',
  },
  siteVisits: {
    unscheduledCount: 0,
    today: [],
    next7: [],
    hrefSiteVisits: '/staff/schedule?view=site-visits',
  },
  pipelineCounts: {},
  recentActivity: [],
  personalTasks: [],
};

function result(
  state: 'pending' | 'cached' | 'fresh' | 'refresh-failed' | 'unavailable',
  knownData = state === 'pending' || state === 'unavailable' ? undefined : data,
) {
  return {
    state,
    data: knownData,
    error: state === 'refresh-failed' || state === 'unavailable' ? new Error(state) : null,
    retry,
    backgroundReady: state === 'fresh',
  };
}

describe('DashboardClient', () => {
  beforeEach(() => {
    retry.mockReset();
    useDashboardData.mockReset();
    useDashboardData.mockReturnValue(result('fresh'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads the selected queue through the cache-first dashboard owner', () => {
    const rendered = renderIntoDocument(<DashboardClient queueMode="next7" />);

    expect(useDashboardData).toHaveBeenCalledWith('next7');
    expect(rendered.container.querySelector('[data-dashboard-state="fresh"]')).not.toBeNull();
    expect(rendered.container.firstElementChild?.getAttribute('data-project-count')).toBe('2');
    rendered.unmount();
  });

  it('renders a truthful frame before any cached or fresh data exists', () => {
    useDashboardData.mockReturnValue(result('pending'));
    const rendered = renderIntoDocument(<DashboardClient queueMode="today" />);

    expect(rendered.container.querySelector('[data-dashboard-state="pending"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Updating dashboard...');
    expect(rendered.container.textContent).not.toContain('Dashboard unavailable');
    rendered.unmount();
  });

  it('retains known data and retries after a refresh failure', () => {
    useDashboardData.mockReturnValue(result('refresh-failed'));
    const rendered = renderIntoDocument(<DashboardClient queueMode="today" />);

    expect(rendered.container.querySelector('[data-dashboard-state="refresh-failed"]')).not.toBeNull();
    expect(rendered.container.firstElementChild?.getAttribute('data-project-count')).toBe('2');
    act(() => {
      (rendered.container.querySelector('button') as HTMLButtonElement).click();
    });
    expect(retry).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });

  it('offers Retry when the first uncached request fails', () => {
    useDashboardData.mockReturnValue({ ...result('refresh-failed'), data: undefined });
    const rendered = renderIntoDocument(<DashboardClient queueMode="today" />);

    expect(rendered.container.textContent).toContain('Could not load the dashboard');
    act(() => {
      (rendered.container.querySelector('button') as HTMLButtonElement).click();
    });
    expect(retry).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });

  it('hides cached data when access ends', () => {
    useDashboardData.mockReturnValue(result('unavailable', data));
    const rendered = renderIntoDocument(<DashboardClient queueMode="today" />);

    expect(rendered.container.querySelector('[data-dashboard-state="unavailable"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Dashboard unavailable');
    expect(rendered.container.firstElementChild?.getAttribute('data-project-count')).toBeNull();
    rendered.unmount();
  });
});
