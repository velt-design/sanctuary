import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardPage from './page';
import type { DashboardData } from '@/lib/dashboard/types';

const getDashboardDataMock = vi.fn();
const requireStaffPageAccessMock = vi.fn();

vi.mock('@/lib/dashboard/getDashboardData', () => ({
  getDashboardData: (...args: unknown[]) => getDashboardDataMock(...args),
}));

vi.mock('@/lib/auth', () => ({
  requireStaffPageAccess: (...args: unknown[]) => requireStaffPageAccessMock(...args),
}));

vi.mock('./DashboardClient', () => ({
  default: (props: { queueMode: string }) => <div data-testid="dashboard-refresher" data-queue-mode={props.queueMode} />,
}));

const sampleData: DashboardData = {
  updatedAtIso: '2026-04-02T00:00:00.000Z',
  kpis: {
    actionsDue: 4,
    newLeads: 2,
    quotesToSend: 1,
    installsThisWeek: 3,
  },
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

describe('DashboardPage', () => {
  beforeEach(() => {
    getDashboardDataMock.mockReset();
    requireStaffPageAccessMock.mockReset();
    requireStaffPageAccessMock.mockResolvedValue({ user: { id: 'user_1' }, role: 'staff' });
  });

  it('parses queue mode from search params and fetches server data before render', async () => {
    getDashboardDataMock.mockResolvedValue(sampleData);

    const ui = (await DashboardPage({
      searchParams: Promise.resolve({ queue: 'next7' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(requireStaffPageAccessMock).toHaveBeenCalledWith('/dashboard');
    expect(getDashboardDataMock).toHaveBeenCalledWith({ queueMode: 'next7', userId: 'user_1' });
    expect(markup).toContain('data-queue-mode="next7"');
    expect(markup).toContain('Dashboard');
    expect(markup).toContain('Actions due');
  });

  it('defaults invalid queue values to today', async () => {
    getDashboardDataMock.mockResolvedValue(sampleData);

    await DashboardPage({
      searchParams: Promise.resolve({ queue: 'not-real' }),
    });

    expect(getDashboardDataMock).toHaveBeenCalledWith({ queueMode: 'today', userId: 'user_1' });
  });

  it('renders dashboard content without depending on client fetch output', async () => {
    getDashboardDataMock.mockResolvedValue(sampleData);

    const ui = (await DashboardPage({
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Dashboard');
    expect(markup).toContain('Recent Activity');
    expect(markup).toContain('data-testid="dashboard-refresher"');
  });
});
