import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardClient from './DashboardClient';
import type { DashboardData } from '@/lib/dashboard/types';
import { qk } from '@/lib/queries/keys';
import { renderIntoDocument } from '../../../../test/reactHarness';

const useQueryMock = vi.fn();
const useQueryClientMock = vi.fn();

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
    useQueryClient: () => useQueryClientMock(),
  };
});

const initialData: DashboardData = {
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
};

describe('DashboardClient', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useQueryClientMock.mockReset();
    useQueryMock.mockReturnValue({});
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('uses the existing dashboard query with initial server data and a single mount refresh', () => {
    const rendered = renderIntoDocument(
      <DashboardClient queueMode="today" initialData={initialData} />,
    );

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: qk.dashboard.data('today'),
        initialData,
        refetchOnMount: 'always',
      }),
    );
    expect(useQueryClientMock).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('preserves surrounding server-rendered content because the refresher never renders a blocking UI', () => {
    const rendered = renderIntoDocument(
      <div>
        <div data-testid="server-content">Server content</div>
        <DashboardClient queueMode="today" initialData={initialData} />
      </div>,
    );

    expect(rendered.container.querySelector('[data-testid="server-content"]')?.textContent).toBe('Server content');
    expect(rendered.container.textContent).toContain('Server content');

    rendered.unmount();
  });
});
