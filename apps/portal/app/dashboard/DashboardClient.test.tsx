import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '@/lib/dashboard/types';
import { renderIntoDocument } from '../../../../test/reactHarness';
import DashboardClient from './DashboardClient';

const retry = vi.fn();
const useDashboardData = vi.fn();
const useDashboardWorkQueue = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined }),
  queryOptions: (options: unknown) => options,
}));

vi.mock('./useDashboardData', () => ({
  useDashboardData: (...args: unknown[]) => useDashboardData(...args),
  useDashboardWorkQueue: (...args: unknown[]) => useDashboardWorkQueue(...args),
}));

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

const data: DashboardData = {
  updatedAtIso: '2026-04-02T00:00:00.000Z',
  kpis: { newLeads: 2, quotesToSend: 1, installsThisWeek: 3 },
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
  pipelineCounts: { NEW: 2 },
  recentEstimates: [],
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
    useDashboardWorkQueue.mockReset();
    useDashboardWorkQueue.mockReturnValue({ items: [], available: true, loading: false });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads the selected queue through the cache-first dashboard owner', () => {
    const rendered = renderIntoDocument(<DashboardClient queueMode="next7" />);

    expect(useDashboardData).toHaveBeenCalledWith('next7');
    expect(rendered.container.querySelector('[data-dashboard-state="fresh"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-page-shell="dashboard"]')).not.toBeNull();
    expect(rendered.container.querySelector('a[href="/staff/projects?journey=ENQUIRY"]')?.textContent).toContain('2');
    rendered.unmount();
  });

  it('renders a truthful frame before any cached or fresh data exists', () => {
    useDashboardData.mockReturnValue(result('pending'));
    const rendered = renderIntoDocument(<DashboardClient queueMode="today" />);

    expect(rendered.container.querySelector('[data-dashboard-state="pending"]')).not.toBeNull();
    const shell = rendered.container.querySelector('[data-portal-page-shell="dashboard"]');
    expect(shell).not.toBeNull();
    expect(shell?.getAttribute('data-portal-page-shell-ready')).toBe('true');
    expect(shell?.hasAttribute('aria-busy')).toBe(false);
    expect(rendered.container.textContent).toContain('Updating dashboard values...');
    expect(rendered.container.querySelector('[aria-label="Project portfolio"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Work Queue"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Recent Activity"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Recent Estimates"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="My Tasks"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-shell-region="dashboard-hero"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-shell-region="dashboard-portfolio"]')).not.toBeNull();
    expect(rendered.container.textContent).not.toContain('Dashboard unavailable');
    rendered.unmount();
  });

  it('renders core Dashboard values while only the Work Queue remains pending', () => {
    useDashboardWorkQueue.mockReturnValue({ items: undefined, available: false, loading: true });
    const rendered = renderIntoDocument(<DashboardClient queueMode="today" />);

    expect(rendered.container.querySelector('[data-dashboard-core-ready="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-dashboard-background-ready="false"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-dashboard-work-queue-ready="false"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Updating project work...');
    expect(rendered.container.textContent).not.toContain('Updating dashboard values...');
    rendered.unmount();
  });

  it('retains known data and retries after a refresh failure', () => {
    useDashboardData.mockReturnValue(result('refresh-failed'));
    const rendered = renderIntoDocument(<DashboardClient queueMode="today" />);

    expect(rendered.container.querySelector('[data-dashboard-state="refresh-failed"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-page-shell="dashboard"]')).not.toBeNull();
    const retryButton = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Retry');
    if (!(retryButton instanceof HTMLButtonElement)) throw new Error('Retry button not found.');
    act(() => {
      retryButton.click();
    });
    expect(retry).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });

  it('offers Retry when the first uncached request fails', () => {
    useDashboardData.mockReturnValue({ ...result('refresh-failed'), data: undefined });
    const rendered = renderIntoDocument(<DashboardClient queueMode="today" />);

    expect(rendered.container.textContent).toContain('Could not load the dashboard');
    expect(rendered.container.querySelector('[aria-label="Project portfolio"]')).not.toBeNull();
    const retryButton = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Retry');
    if (!(retryButton instanceof HTMLButtonElement)) throw new Error('Retry button not found.');
    act(() => {
      retryButton.click();
    });
    expect(retry).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });

  it('hides cached data when access ends', () => {
    useDashboardData.mockReturnValue(result('unavailable', data));
    const rendered = renderIntoDocument(<DashboardClient queueMode="today" />);

    expect(rendered.container.querySelector('[data-dashboard-state="unavailable"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Dashboard unavailable');
    expect(rendered.container.querySelector('[data-portal-page-shell="dashboard"]')).toBeNull();
    rendered.unmount();
  });
});
