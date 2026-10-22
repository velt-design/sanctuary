import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderIntoDocument } from '../../../../test/reactHarness';
import DashboardClient from './DashboardClient';
import { dashboardFixture, visitsFixture } from '@/app/qa/portal-progressive-fixture/data';
import type { DashboardPartLoader } from '@/lib/dashboard/dashboardPartTransport';
import { qk } from '@/lib/queries/keys';

const routerPrefetch = vi.fn();
const routerReplace = vi.fn();
const nativeClick = vi.fn();

// Inspect the prefetch contract passed to Next. Browser viewport scheduling and
// ordinary navigation remain separate optimized-build checks, not this DOM test.
vi.mock('next/link', () => ({
  default: ({ children, prefetch, onClick, ...props }: any) => <a
    {...props} data-next-prefetch={String(prefetch)}
    onClick={(event) => {
      onClick?.(event);
      nativeClick(event.currentTarget.getAttribute('href'), event.defaultPrevented);
      event.preventDefault();
    }}
  >{children}</a>,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: routerPrefetch, replace: routerReplace }),
  usePathname: () => '/dashboard', useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/components/layout/GlobalPortalSearch.client', () => ({ default: () => null }));

beforeEach(() => {
  routerPrefetch.mockReset(); routerReplace.mockReset(); nativeClick.mockReset();
  window.history.replaceState(null, '', '/dashboard');
});
afterEach(() => { document.body.innerHTML = ''; });
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });

it('keeps all five real Dashboard link owners intent-only while complete independent facts and active reads remain intact', async () => {
  const data = dashboardFixture();
  const projectId = '99999999-9999-4999-8999-999999999999';
  const queueHref = `/staff/projects/${projectId}?tab=activity#work`;
  const estimateHref = `/staff/projects/${projectId}?tab=estimates&estimateId=est_demo#price`;
  const activityHref = `/staff/projects/${projectId}?tab=activity#notes`;
  data.projectWorkQueue = [{
    projectId, projectName: 'Demo courtyard', stage: 'contacted', group: 'today',
    actionKind: 'workItem', title: 'Review fictional work', reason: 'Fictional read-only task.',
    dueAt: null, priority: 'NORMAL', blockedReason: null, effectiveAssignee: { kind: 'unassigned' },
    workItemId: projectId, workItemRowVersion: 1, stateRowVersion: 1,
    sourceType: 'LEAD_CADENCE', sourceKey: 'fictional', subjectKind: 'PROJECT', subjectId: projectId,
    href: queueHref,
  }];
  data.recentEstimates = [{
    projectId, projectName: 'Demo courtyard', estimateId: 'est_demo', versionLabel: 'V1',
    status: 'draft', customerPriceIncGst: 1000, updatedAt: data.updatedAtIso, href: estimateHref,
  }];
  data.recentActivity[0].href = activityHref;
  let finish!: () => void;
  const secondary = new Promise<void>(resolve => { finish = resolve; });
  let readSignal: AbortSignal | undefined;
  const loader = vi.fn<DashboardPartLoader>(async (_queue, signal, publish) => {
    readSignal = signal;
    publish({
      pipelineCounts: { pipelineCounts: data.pipelineCounts, pipelineCountsAvailable: true, pipelineCountsScope: 'open_enquiry_proposal_v1' },
      projectStateCounts: { projectStateCounts: data.projectStateCounts, projectStateCountsAvailable: true },
      projectWorkQueue: { projectWorkQueue: data.projectWorkQueue, projectWorkQueueAvailable: true },
      recentEstimates: { recentEstimates: data.recentEstimates },
      recentActivity: { recentActivity: data.recentActivity }, personalTasks: { personalTasks: [] },
    });
    await secondary;
    return data;
  });
  const visits = visitsFixture(), visitsLoader = vi.fn(async () => visits);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const prefetchQuery = vi.spyOn(client, 'prefetchQuery');
  const cancelQueries = vi.spyOn(client, 'cancelQueries');
  const view = renderIntoDocument(<QueryClientProvider client={client}>
    <DashboardClient queueMode="today" partsLoader={loader} visitsLoader={visitsLoader} readOnly />
  </QueryClientProvider>);
  try {
    await flush();
    expect(view.container.querySelector('[data-dashboard-portfolio="ready"]')).not.toBeNull();
    expect(view.container.querySelector('[data-dashboard-background-ready="false"]')).not.toBeNull();
    const links = [...view.container.querySelectorAll<HTMLAnchorElement>('a')];
    expect(links.length).toBeGreaterThan(8);
    expect(links.every(link => link.dataset.nextPrefetch === 'false')).toBe(true);
    expect(routerPrefetch).not.toHaveBeenCalled();
    expect(prefetchQuery).not.toHaveBeenCalled();
    const visitHref = `/staff/site-visits?project=${projectId}&view=today#visit-${visits.events[0].id}`;
    const expected = ['/staff/projects/new', '/staff/calculator', '/staff/schedule',
      '/staff/projects/work-queue', queueHref, estimateHref, activityHref, '/staff/site-visits', visitHref];
    for (const href of expected) {
      const link = links.find(candidate => candidate.getAttribute('href') === href);
      expect(link, href).toBeDefined();
      act(() => link!.dispatchEvent(new Event('focusin', { bubbles: true, cancelable: true })));
      expect(routerPrefetch).toHaveBeenLastCalledWith(href);
    }
    expect(routerPrefetch).toHaveBeenCalledTimes(expected.length);
    expect(prefetchQuery).not.toHaveBeenCalled();
    const schedule = links.find(link => link.getAttribute('href') === '/staff/schedule')!;
    act(() => schedule.click());
    expect(nativeClick).toHaveBeenLastCalledWith('/staff/schedule', false);
    expect(routerReplace).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/dashboard');
    expect(cancelQueries).not.toHaveBeenCalled();
    expect(readSignal?.aborted).toBe(false);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(visitsLoader).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(qk.dashboard.data('today'))).toBeUndefined();
    await act(async () => { finish(); });
    await flush();
    expect(client.getQueryData(qk.dashboard.data('today'))).toBe(data);
    expect(view.container.querySelector('[data-dashboard-background-ready="true"]')).not.toBeNull();
    expect(view.container.querySelector('a[href="/staff/schedule"]')).toBe(schedule);
    expect(view.container.textContent).toContain('Review fictional work');
  } finally {
    finish(); view.unmount(); client.clear();
  }
});
