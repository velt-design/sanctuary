import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardView from './DashboardView';
import type { DashboardData } from '@/lib/dashboard/types';

vi.mock('./_components/SetNextActionButton', () => ({
  default: () => <button type="button">Set next action</button>,
}));

const data: DashboardData = {
  updatedAtIso: '2026-04-02T00:00:00.000Z',
  kpis: {
    actionsDue: 4,
    newLeads: 2,
    quotesToSend: 1,
    installsThisWeek: 3,
  },
  attention: [],
  workQueue: [
    {
      projectId: 'proj_123',
      projectName: 'Beach House',
      clientName: 'Alex',
      status: 'NEW',
      nextActionLabel: null,
      nextActionDueDate: '2026-04-03',
      lastActivityAt: '2026-04-02T10:00:00.000Z',
    },
  ],
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
};

describe('DashboardView', () => {
  it('renders work queue rows with the next-action client island inside server markup', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} queueMode="today" />);

    expect(markup).toContain('Beach House');
    expect(markup).toContain('Set next action');
    expect(markup).toContain('Dashboard');
  });
});
