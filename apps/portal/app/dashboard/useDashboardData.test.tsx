import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/repo/apiClient';
import { qk } from '@/lib/queries/keys';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { useDashboardData } from './useDashboardData';

const useQuery = vi.fn();
const retry = vi.fn();
const cached = {
  updatedAtIso: '2026-04-02T00:00:00.000Z',
  kpis: { newLeads: 2, quotesToSend: 3, installsThisWeek: 4 },
  schedule: { startingSoon: [], crewAvailability: [], hrefBoard: '/board', hrefGantt: '/gantt' },
  siteVisits: { unscheduledCount: 0, today: [], next7: [], hrefSiteVisits: '/visits' },
  pipelineCounts: {},
  recentActivity: [],
  personalTasks: [],
};

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: (...args: unknown[]) => useQuery(...args) };
});

function Probe() {
  const result = useDashboardData('today');
  return <div data-state={result.state} data-known={result.data ? 'true' : 'false'} />;
}

describe('useDashboardData', () => {
  beforeEach(() => {
    useQuery.mockReset();
    retry.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('uses the user-owned dashboard query and always refreshes quietly on mount', () => {
    useQuery.mockReturnValue({ data: cached, error: null, isFetching: true, refetch: retry });
    const rendered = renderIntoDocument(<Probe />);

    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: qk.dashboard.data('today'),
      refetchOnMount: 'always',
      retry: expect.any(Function),
    }));
    expect(rendered.container.firstElementChild?.getAttribute('data-state')).toBe('cached');
    rendered.unmount();
  });

  it('distinguishes pending, cached, and fresh reads', () => {
    useQuery.mockReturnValueOnce({ data: undefined, error: null, isFetching: true, refetch: retry });
    const pending = renderIntoDocument(<Probe />);
    expect(pending.container.firstElementChild?.getAttribute('data-state')).toBe('pending');
    pending.unmount();

    useQuery.mockReturnValueOnce({ data: cached, error: null, isFetching: true, refetch: retry });
    const cachedRender = renderIntoDocument(<Probe />);
    expect(cachedRender.container.firstElementChild?.getAttribute('data-state')).toBe('cached');
    cachedRender.unmount();

    useQuery.mockReturnValueOnce({ data: cached, error: null, isFetching: false, refetch: retry });
    const fresh = renderIntoDocument(<Probe />);
    expect(fresh.container.firstElementChild?.getAttribute('data-state')).toBe('fresh');
    fresh.unmount();
  });

  it('retains cached data after network and server failures', () => {
    useQuery.mockReturnValue({
      data: cached,
      error: new ApiError('failed', { status: 500, body: {} }),
      isFetching: false,
      refetch: retry,
    });
    const rendered = renderIntoDocument(<Probe />);

    expect(rendered.container.firstElementChild?.getAttribute('data-state')).toBe('refresh-failed');
    expect(rendered.container.firstElementChild?.getAttribute('data-known')).toBe('true');
    rendered.unmount();
  });

  it.each([401, 403])('hides cached data after an access-ending %s response', (status) => {
    useQuery.mockReturnValue({
      data: cached,
      error: new ApiError('denied', { status, body: {} }),
      isFetching: false,
      refetch: retry,
    });
    const rendered = renderIntoDocument(<Probe />);

    expect(rendered.container.firstElementChild?.getAttribute('data-state')).toBe('unavailable');
    expect(rendered.container.firstElementChild?.getAttribute('data-known')).toBe('false');
    rendered.unmount();
  });
});
