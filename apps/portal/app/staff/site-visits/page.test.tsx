import { beforeEach, expect, it, vi } from 'vitest';
import { headers } from 'next/headers';
import { requireStaffPageAccess } from '@/lib/auth';
import { loadCalendarVisitsInitialRead } from './loadCalendarVisitsInitialRead';
import Page from './page';
vi.mock('next/server', () => ({ connection: vi.fn() }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/auth', () => ({ requireStaffPageAccess: vi.fn() }));
vi.mock('./loadCalendarVisitsInitialRead', () => ({ loadCalendarVisitsInitialRead: vi.fn() }));
vi.mock('@/components/site-visits/SiteVisitsAgenda', () => ({ default: () => null }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireStaffPageAccess).mockResolvedValue({ user: { id: 'staff-a' }, role: 'staff' } as never);
  vi.mocked(headers).mockResolvedValue(new Headers({ host: 'portal.example.test', 'x-portal-document-callback': '/staff/site-visits?view=history' }) as never);
});
it('starts only after the verified gate and returns without awaiting the calendar data', async () => {
  let authorize!: (session: never) => void;
  vi.mocked(requireStaffPageAccess).mockReturnValue(new Promise(resolve => { authorize = resolve; }));
  vi.mocked(loadCalendarVisitsInitialRead).mockReturnValue({ result: new Promise(() => {}) } as never);
  const page = Page({ searchParams: Promise.resolve({ project: ['proj_first', 'ignored'], visit: 'exact', view: 'history', q: 'keep', person: 'keep' }) });
  await Promise.resolve(); expect(loadCalendarVisitsInitialRead).not.toHaveBeenCalled();
  authorize({ user: { id: 'staff-a' }, role: 'staff' } as never);
  expect((await page).props.children.props.initialRead).toBeDefined();
  expect(loadCalendarVisitsInitialRead).toHaveBeenCalledWith('staff-a', 'portal.example.test', { project: 'proj_first', visit: 'exact' });
});
it('leaves view/person/search on the client and matches empty scope to the ordinary hook', async () => {
  await Page({ searchParams: Promise.resolve({ project: '', visit: [], view: 'review', person: 'unassigned', q: 'garden' }) });
  expect(loadCalendarVisitsInitialRead).toHaveBeenCalledWith('staff-a', 'portal.example.test', { project: null, visit: null });
});
it('does not start a private read after denial', async () => {
  vi.mocked(requireStaffPageAccess).mockRejectedValue(new Error('NEXT_REDIRECT'));
  await expect(Page({})).rejects.toThrow('NEXT_REDIRECT');
  expect(loadCalendarVisitsInitialRead).not.toHaveBeenCalled();
});
it('keeps RSC/prefetch and unrelated document contexts on the normal API path', async () => {
  for (const callback of ['', '/staff/projects']) {
    vi.mocked(headers).mockResolvedValue(new Headers({ 'x-portal-document-callback': callback }) as never);
    expect((await Page({})).props.children.props.initialRead).toBeUndefined();
  }
  expect(requireStaffPageAccess).toHaveBeenCalledTimes(2);
  expect(loadCalendarVisitsInitialRead).not.toHaveBeenCalled();
});
