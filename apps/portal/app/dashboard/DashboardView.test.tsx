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

function withWorkQueue(projectNames: string[]): DashboardData {
  return {
    ...data,
    workQueue: projectNames.map((projectName, index) => ({
      projectId: `proj_${index}`,
      projectName,
      clientName: `Client ${index}`,
      status: 'NEW',
      nextActionLabel: null,
      nextActionDueDate: '2026-04-03',
      lastActivityAt: '2026-04-02T10:00:00.000Z',
    })),
  };
}

describe('DashboardView', () => {
  it('renders work queue rows with the next-action client island inside server markup', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} queueMode="today" />);

    expect(markup).toContain('Beach House');
    expect(markup).toContain('Set next action');
    expect(markup).toContain('Dashboard');
  });

  it('prioritizes pipeline before kpis and operational cards', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} queueMode="today" />);

    const pipelineIndex = markup.indexOf('Pipeline');
    const kpiIndex = markup.indexOf('Actions due');
    const attentionIndex = markup.indexOf('Attention');

    expect(pipelineIndex).toBeGreaterThan(-1);
    expect(kpiIndex).toBeGreaterThan(-1);
    expect(attentionIndex).toBeGreaterThan(-1);
    expect(pipelineIndex).toBeLessThan(kpiIndex);
    expect(pipelineIndex).toBeLessThan(attentionIndex);
  });

  it('keeps the work queue to a compact preview with a view-all path', () => {
    const compactData = withWorkQueue(['First Project', 'Second Project', 'Third Project', 'Fourth Project']);
    const markup = renderToStaticMarkup(<DashboardView data={compactData} queueMode="today" />);

    expect(markup).toContain('First Project');
    expect(markup).toContain('Second Project');
    expect(markup).toContain('Third Project');
    expect(markup).not.toContain('Fourth Project');
    expect(markup).toContain('View all actions');
  });
});
