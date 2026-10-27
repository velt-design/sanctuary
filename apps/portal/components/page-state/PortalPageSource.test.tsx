import { act, useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, onTestFinished, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import ContactsIndexClient from '@/app/staff/contacts/ContactsIndexClient';
import ScheduleClient from '@/app/staff/schedule/ScheduleClient';
import { useScheduleWorkspace } from '@/app/staff/schedule/ScheduleWorkspace';
import { progressiveScheduleSnapshot } from '@/app/qa/schedule-progressive-fixture/snapshot';
import { contactsIndexQueryOptions } from '@/lib/queries/contactsIndex';
import type { ContactsIndexResponse } from '@/lib/contacts/contactsIndexContract';
import PortalActualFrames from './PortalActualFrames';
import { PortalGuardedPage, PortalPageSourceProvider, usePortalPageSourceController, projectDetailPath, publicFramePath, type PortalPageCompletion } from './PortalPageSource';

const api = vi.fn();
const privateCode = vi.hoisted(() => ({ board: null as Promise<void> | null }));
vi.mock('@/lib/repo/apiClient', async original => ({
  ...await original<typeof import('@/lib/repo/apiClient')>(), apiJson: (...args: unknown[]) => api(...args),
}));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock('next/dynamic', async () => {
  const { default: Loadable } = await vi.importActual<typeof import('next/dist/shared/lib/lazy-dynamic/loadable')>('next/dist/shared/lib/lazy-dynamic/loadable');
  const { default: Diagnostics } = await import('@/app/staff/schedule/ScheduleDiagnosticsPanel');
  return { default: (loader: () => Promise<any>, options?: object) => loader.toString().includes('ScheduleDiagnosticsPanel')
    // Keep the actual dev-only panel, without its unrelated lazy module's
    // module scheduling in this harness. Board/Gantt use the installed Loadable.
    ? Diagnostics : Loadable({ loader: async () => {
    if (loader.toString().includes('ScheduleBoardView') && privateCode.board) await privateCode.board;
    return loader();
  }, ...options }) };
});
vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseRuntimeUrl: () => 'https://fictional.invalid', supabaseHostFromUrl: () => 'fictional',
}));
vi.mock('@/components/ui/toast/ToastProvider', () => ({ useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }) }));

const cached: ContactsIndexResponse = {
  contacts: { rows: [{ id: 'ct_fictional', displayName: 'Private fictional contact', email: '', phone: '',
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }],
  totalCount: 1, truncated: false, page: 1, pageSize: 50, totalPages: 1 },
  query: { search: '', sort: 'name_asc' as const }, generatedAt: '2026-10-23T00:00:00Z',
};
let privateMounts = 0;
function PrivateDashboard() {
  useEffect(() => { privateMounts++; return () => { privateMounts--; }; }, []);
  return <p>Actual outgoing Dashboard</p>;
}
function Harness({ canonical, leaf, pathname = window.location.pathname, href = '/staff/contacts' }: {
  canonical: string; leaf: ReactNode; pathname?: string; href?: string;
}) {
  const controller = usePortalPageSourceController(pathname, canonical, window.location.search.slice(1));
  return <PortalPageSourceProvider value={controller}>
    <button onClick={() => {
      controller.begin(href);
      window.history.pushState(null, '', href);
    }}>Accepted Contacts navigation</button>
    <button data-cancel-selection onClick={() => {
      controller.cancel(); window.history.replaceState(null, '', canonical);
    }}>Cancel pending selection</button>
    <PortalActualFrames>{leaf}</PortalActualFrames>
  </PortalPageSourceProvider>;
}
async function settle() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
}


function expectScheduleReadFailure(container: HTMLElement, message: string) {
  const header = container.querySelector('[data-ui-foundation-consumer="schedule"] header')!;
  expect(header.textContent).toContain('Schedule data could not load');
  expect([...header.querySelectorAll('button')].find(button => button.textContent === 'Retry')).toBeDefined();
  const details = [...header.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Details')!;
  act(() => { details.focus(); details.click(); });
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain(message);
  expect(dialog.textContent).toContain('Host: fictional');
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(details);
}


let client: QueryClient;
beforeEach(() => {
  window.history.replaceState(null, '', '/dashboard');
  api.mockReset(); api.mockImplementation(() => new Promise(() => {}));
  privateMounts = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(contactsIndexQueryOptions().queryKey, cached);
});
afterEach(() => { client.clear(); document.body.innerHTML = ''; });

it('keeps one actual frame while a fresh selected leaf gates cached rows, commands and private observers', async () => {
  const dashboardCompletion = {};
  const dashboard = <PortalGuardedPage pathname="/dashboard" completion={dashboardCompletion}><PrivateDashboard /></PortalGuardedPage>;
  const ui = (canonical: string, leaf: ReactNode) => <QueryClientProvider client={client}>
    <Harness canonical={canonical} leaf={leaf} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui('/dashboard', dashboard));
  expect(privateMounts).toBe(1);
  act(() => view.container.querySelector('button')!.click());
  await settle();
  expect(privateMounts).toBe(0);
  expect(window.location.pathname).toBe('/staff/contacts');
  expect(view.container.querySelector('h1')?.textContent).toBe('Contacts');
  expect(view.container.textContent).toContain('Reading contacts');
  expect(view.container.textContent).not.toContain('Private fictional contact');
  expect(view.container.querySelector('[href="/staff/contacts/new"]')).toBeNull();
  expect(api).not.toHaveBeenCalled();
  expect(client.getQueryCache().find({ queryKey: contactsIndexQueryOptions().queryKey })!.getObserversCount()).toBe(0);
  const table = view.container.querySelector('table');
  const input = view.container.querySelector('#contactSearch');
  // URL/context changes alone cannot revive the old mounted source.
  view.rerender(ui('/staff/contacts', dashboard));
  await settle();
  expect(api).not.toHaveBeenCalled();
  const contactCompletion = {};
  view.rerender(ui('/staff/contacts', <PortalGuardedPage pathname="/staff/contacts" completion={contactCompletion}>
    <ContactsIndexClient />
  </PortalGuardedPage>));
  await settle();
  expect(api).toHaveBeenCalledTimes(1);
  expect(view.container.textContent).toContain('Private fictional contact');
  expect(view.container.querySelector('[href="/staff/contacts/new"]')).not.toBeNull();
  expect(view.container.querySelector('table')).toBe(table);
  expect(view.container.querySelector('#contactSearch')).toBe(input);
  view.unmount();
});

it('retains accepted Contacts across Next\'s stale pathname render until the guarded leaf actually adopts', async () => {
  const completion = {};
  const dashboard = <PortalGuardedPage pathname="/dashboard" completion={completion}><PrivateDashboard /></PortalGuardedPage>;
  const ui = (pathname: string, canonical: string, leaf: ReactNode) => <QueryClientProvider client={client}>
    <Harness pathname={pathname} canonical={canonical} leaf={leaf} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui('/dashboard', '/dashboard', dashboard));
  act(() => view.container.querySelector('button')!.click());
  await settle();
  // The actual window URL is already selected, while Next's restore transition
  // and retained LayoutRouter still report the previous Dashboard selection.
  expect(window.location.pathname).toBe('/staff/contacts');
  expect(view.container.querySelector('h1')?.textContent).toBe('Contacts');
  expect(privateMounts).toBe(0);
  expect(view.container.textContent).toContain('Reading contacts');
  expect(view.container.textContent).not.toContain('Private fictional contact');
  expect(view.container.querySelector('[href="/staff/contacts/new"]')).toBeNull();
  expect(api).not.toHaveBeenCalled();
  expect(client.getQueryCache().find({ queryKey: contactsIndexQueryOptions().queryKey })!.getObserversCount()).toBe(0);
  const input = view.container.querySelector('#contactSearch');
  const table = view.container.querySelector('table');
  // Publishing just the optimistic pathname, or even an old mounted completion
  // under the new canonical selection, is not fresh leaf adoption.
  view.rerender(ui('/staff/contacts', '/dashboard', dashboard)); await settle();
  view.rerender(ui('/staff/contacts', '/staff/contacts', dashboard)); await settle();
  expect(api).not.toHaveBeenCalled();
  view.rerender(ui('/staff/contacts', '/staff/contacts',
    <PortalGuardedPage pathname="/staff/contacts" completion={{}}><ContactsIndexClient /></PortalGuardedPage>));
  await settle();
  expect(api).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector('#contactSearch')).toBe(input);
  expect(view.container.querySelector('table')).toBe(table);
  expect(view.container.textContent).toContain('Private fictional contact');
  view.unmount();
});

it('retires the held frame only after a different unsupported destination really adopts', async () => {
  const dashboard = <PortalGuardedPage pathname="/dashboard" completion={{}}><PrivateDashboard /></PortalGuardedPage>;
  const ui = (pathname: string, canonical: string, leaf: ReactNode) => <QueryClientProvider client={client}>
    <Harness pathname={pathname} canonical={canonical} leaf={leaf} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui('/dashboard', '/dashboard', dashboard));
  act(() => view.container.querySelector('button')!.click()); await settle();
  expect(view.container.querySelector('h1')?.textContent).toBe('Contacts');
  window.history.replaceState(null, '', '/staff/site-visits');
  view.rerender(ui('/staff/site-visits', '/dashboard', dashboard)); await settle();
  expect(view.container.querySelector('h1')?.textContent).toBe('Contacts');
  view.rerender(ui('/staff/site-visits', '/staff/site-visits',
    <PortalGuardedPage pathname="/staff/site-visits" completion={{}}><h1>Actual Site Visits</h1></PortalGuardedPage>));
  await settle();
  expect(view.container.querySelector('h1')?.textContent).toBe('Actual Site Visits');
  expect(api).not.toHaveBeenCalled();
  view.unmount();
});

it('keeps the actual Gantt calendar and safe view controls while the private Schedule reader awaits adoption', async () => {
  const initial = {};
  const dashboard = <PortalGuardedPage pathname="/dashboard" completion={initial}><PrivateDashboard /></PortalGuardedPage>;
  const ui = (canonical: string, leaf: ReactNode) => <QueryClientProvider client={client}>
    <Harness canonical={canonical} href="/staff/schedule?view=gantt" leaf={leaf} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui('/dashboard', dashboard));
  act(() => view.container.querySelector('button')!.click());
  // Actual installed Loadable and actual calendar components, not a toolbar stub.
  await act(async () => { await import('@/app/staff/schedule/ScheduleFrame');
    await import('@/app/staff/schedule/ScheduleGanttView'); });
  await settle();
  expect(privateMounts).toBe(0);
  expect(view.container.querySelector('h1')?.textContent).toBe('Schedule');
  expect(view.container.querySelector('[aria-pressed="true"]')?.textContent).toBe('Gantt');
  expect(view.container.textContent).toContain('Today');
  expect(view.container.textContent).not.toContain('0 of 0');
  const heading = view.container.querySelector('h1');
  const buttons = Array.from(view.container.querySelectorAll('button'));
  const ganttButton = buttons.find(button => button.textContent === 'Gantt');
  const todayButton = buttons.find(button => button.textContent === 'Today');
  const load = vi.fn(async () => progressiveScheduleSnapshot());
  expect(load).not.toHaveBeenCalled();
  view.rerender(ui('/staff/schedule', <PortalGuardedPage pathname="/staff/schedule" completion={{}}>
    <ScheduleClient snapshotLoaders={{ board: load, gantt: load }} initialSeedKind="gantt" />
  </PortalGuardedPage>));
  await settle();
  expect(load).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector('h1')).toBe(heading);
  expect(Array.from(view.container.querySelectorAll('button')).find(button => button.textContent === 'Gantt')).toBe(ganttButton);
  expect(Array.from(view.container.querySelectorAll('button')).find(button => button.textContent === 'Today')).toBe(todayButton);
  expect(view.container.textContent).toContain('Forecast');
  view.unmount();
});

it('fills the same Board viewport through one private Dnd context and removes its rows on source denial', async () => {
  let releaseCode!: () => void;
  privateCode.board = new Promise<void>(resolve => { releaseCode = resolve; });
  const dashboard = <PortalGuardedPage pathname="/dashboard" completion={{}}><PrivateDashboard /></PortalGuardedPage>;
  const ui = (canonical: string, leaf: ReactNode) => <QueryClientProvider client={client}>
    <Harness pathname={window.location.pathname} canonical={canonical} href="/staff/schedule?view=board" leaf={leaf} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui('/dashboard', dashboard));
  let unmounted = false;
  onTestFinished(() => { privateCode.board = null; releaseCode(); if (!unmounted) view.unmount(); });
  act(() => view.container.querySelector('button')!.click());
  await settle();
  const heading = view.container.querySelector('h1');
  const input = view.container.querySelector<HTMLInputElement>('[aria-label="Search unscheduled projects"]')!;
  const lanes = view.container.querySelector('[data-board-lanes]');
  const unscheduled = view.container.querySelector('aside[aria-label="Unscheduled jobs"]');
  expect(input).not.toBeNull();
  expect(document.querySelectorAll('[id^="DndDescribedBy-"]')).toHaveLength(0);
  expect(view.container.querySelector('[data-schedule-card-id]')).toBeNull();
  const completion = {};
  const load = vi.fn(async () => progressiveScheduleSnapshot());
  const leaf = (unavailable = false) => <PortalGuardedPage pathname="/staff/schedule" completion={completion} unavailable={unavailable}>
    <ScheduleClient snapshotLoaders={{ board: load, gantt: load }} initialSeedKind="board" />
  </PortalGuardedPage>;
  await act(async () => { view.root.render(ui('/staff/schedule', leaf())); });
  await settle();
  expect(load).toHaveBeenCalledTimes(1);
  // The fresh query commits even while the installed Loadable's private
  // renderer promise is held. The actual public viewport stays in place.
  expect(view.container.querySelector('[data-schedule-card-id]')).toBeNull();
  await act(async () => { releaseCode(); await import('@/app/staff/schedule/ScheduleBoardView'); });
  await settle();
  expect(view.container.querySelector('h1')).toBe(heading);
  expect(view.container.querySelector('[aria-label="Search unscheduled projects"]')).toBe(input);
  expect(view.container.querySelector('[data-board-lanes]')).toBe(lanes);
  expect(view.container.querySelector('aside[aria-label="Unscheduled jobs"]')).toBe(unscheduled);
  expect(unscheduled?.querySelector('[data-schedule-card-id]')).not.toBeNull();
  expect(lanes?.querySelector('[data-schedule-card-id]')).not.toBeNull();
  const moves = [...view.container.querySelectorAll('[aria-roledescription="draggable"]')];
  expect(moves.length).toBeGreaterThan(1);
  const descriptions = new Set(moves.map(node => node.getAttribute('aria-describedby')));
  expect(descriptions.size).toBe(1);
  expect([...descriptions][0]).toMatch(/^DndDescribedBy-/);
  expect(document.querySelectorAll('[id^="DndDescribedBy-"]')).toHaveLength(1);
  view.rerender(ui('/staff/schedule', leaf(true))); await settle();
  expect(view.container.querySelector('[data-schedule-card-id]')).toBeNull();
  expect(document.querySelectorAll('[id^="DndDescribedBy-"]')).toHaveLength(0);
  expect(view.container.querySelector('[aria-label="Search unscheduled projects"]')).toBe(input);
  expect(view.container.textContent).toContain('Schedule unavailable');
  view.unmount();
  unmounted = true;
});

it('toggles the same adopted Board without rerendering its private context consumer or date rows', async () => {
  let resolveRead!: (value: ReturnType<typeof progressiveScheduleSnapshot>) => void;
  const read = vi.fn(() => new Promise<ReturnType<typeof progressiveScheduleSnapshot>>(resolve => { resolveRead = resolve; }));
  let privateRenders = 0;
  function PrivateConsumer() { useScheduleWorkspace(); privateRenders++; return null; }
  const completion = {};
  const leaf = (denied = false) => <PortalGuardedPage pathname="/staff/schedule" completion={completion} unavailable={denied}>
    <PrivateConsumer /><ScheduleClient snapshotLoaders={{ board: read, gantt: read }} />
  </PortalGuardedPage>;
  const dashboard = <PortalGuardedPage pathname="/dashboard" completion={{}}><PrivateDashboard /></PortalGuardedPage>;
  const ui = (canonical: string, child: ReactNode) => <QueryClientProvider client={client}>
    <Harness canonical={canonical} href="/staff/schedule?view=board" leaf={child} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui('/dashboard', dashboard));
  onTestFinished(() => view.unmount());
  act(() => view.container.querySelector('button')!.click()); await settle();
  const toggle = view.container.querySelector<HTMLButtonElement>('[aria-expanded][aria-label$="unscheduled panel"]')!;
  const panel = view.container.querySelector<HTMLElement>('aside[aria-label="Unscheduled jobs"]')!;
  const input = view.container.querySelector<HTMLInputElement>('[aria-label="Search unscheduled projects"]')!;
  const lanes = view.container.querySelector<HTMLElement>('[data-board-lanes]')!;
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  act(() => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(panel.getAttribute('data-collapsed')).toBe('false');
  act(() => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(privateRenders).toBe(0);
  expect(read).not.toHaveBeenCalled();
  await act(async () => view.rerender(ui('/staff/schedule', leaf())));
  await settle();
  await act(async () => { resolveRead(progressiveScheduleSnapshot()); await import('@/app/staff/schedule/ScheduleBoardView'); });
  await settle();
  expect(read).toHaveBeenCalledTimes(1);
  expect(lanes.querySelector('[data-schedule-card-id]')).not.toBeNull();
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  input.focus(); lanes.scrollLeft = 65; lanes.scrollTop = 90;
  const renders = privateRenders;
  const formatter = vi.spyOn(Intl, 'DateTimeFormat');
  try {
    for (const expanded of ['true', 'false', 'true']) {
      act(() => toggle.click());
      expect(toggle.getAttribute('aria-expanded')).toBe(expanded);
      expect(panel.getAttribute('data-collapsed')).toBe(expanded === 'true' ? 'false' : 'true');
      await settle();
      expect(privateRenders).toBe(renders);
      expect(formatter).not.toHaveBeenCalled();
      expect(read).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(input);
      expect(view.container.querySelector('aside[aria-label="Unscheduled jobs"]')).toBe(panel);
      expect(view.container.querySelector('[data-board-lanes]')).toBe(lanes);
      expect(lanes.scrollLeft).toBe(65); expect(lanes.scrollTop).toBe(90);
    }
  } finally { formatter.mockRestore(); }
  await act(async () => view.rerender(ui('/staff/schedule', leaf(true))));
  await settle();
  expect(view.container.querySelector('[data-schedule-card-id]')).toBeNull();
  expect(view.container.querySelector('[aria-label="Search unscheduled projects"]')).toBe(input);
  act(() => toggle.click());
  expect(panel.getAttribute('data-collapsed')).toBe('true');
  expect(read).toHaveBeenCalledTimes(1);
});

it('keeps early Find input and selection through adoption without reading a different cached query', async () => {
  let resolveRead!: (value: ContactsIndexResponse) => void;
  api.mockImplementation(() => new Promise(resolve => { resolveRead = resolve; }));
  const dashboard = <PortalGuardedPage pathname="/dashboard" completion={{}}><PrivateDashboard /></PortalGuardedPage>;
  const ui = (canonical: string, leaf: ReactNode) => <QueryClientProvider client={client}>
    <Harness canonical={canonical} leaf={leaf} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui('/dashboard', dashboard));
  act(() => view.container.querySelector('button')!.click()); await settle();
  const input = view.container.querySelector<HTMLInputElement>('#contactSearch')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Fictional');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); });
  expect(api).not.toHaveBeenCalled();
  view.rerender(ui('/staff/contacts', <PortalGuardedPage pathname="/staff/contacts" completion={{}}>
    <ContactsIndexClient />
  </PortalGuardedPage>));
  await settle();
  expect(api).toHaveBeenCalledTimes(1);
  expect(api.mock.calls[0][0]).toContain('q=Fictional');
  expect(view.container.textContent).not.toContain('Private fictional contact');
  await act(async () => resolveRead({ ...cached, query: { ...cached.query, search: 'Fictional' } }));
  await settle();
  expect(view.container.querySelector('#contactSearch')).toBe(input);
  expect(input.value).toBe('Fictional');
  expect(view.container.textContent).toContain('Private fictional contact');
  view.unmount();
});

it('clears genuine facts and commands on a denied selected source and rejects its old completion', async () => {
  const first = {};
  window.history.replaceState(null, '', '/staff/contacts');
  const ui = (completion: PortalPageCompletion, unavailable = false) => <QueryClientProvider client={client}>
    <Harness canonical="/staff/contacts" leaf={<PortalGuardedPage pathname="/staff/contacts" completion={completion}
      unavailable={unavailable}><ContactsIndexClient /></PortalGuardedPage>} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui(first)); await settle();
  const table = view.container.querySelector('table');
  const input = view.container.querySelector('#contactSearch');
  expect(view.container.textContent).toContain('Private fictional contact');
  view.rerender(ui({}, true)); await settle();
  expect(view.container.textContent).not.toContain('Private fictional contact');
  expect(view.container.querySelector('[href="/staff/contacts/new"]')).toBeNull();
  expect(view.container.textContent).toContain('Contacts unavailable');
  expect(view.container.querySelector('table')).toBe(table);
  expect(view.container.querySelector('#contactSearch')).toBe(input);
  view.rerender(ui(first)); await settle();
  expect(view.container.textContent).not.toContain('Private fictional contact');
  expect(client.getQueryCache().find({ queryKey: contactsIndexQueryOptions().queryKey })!.getObserversCount()).toBe(0);
  view.rerender(ui({})); await settle();
  expect(view.container.textContent).toContain('Private fictional contact');
  expect(view.container.querySelector('#contactSearch')).toBe(input);
  view.unmount();
});

it('keeps explicit denial effective through cancellation, rebegin and late old completion while a distinct completion can recover', async () => {
  const denied = {}, fresh = {};
  window.history.replaceState(null, '', '/staff/contacts');
  const ui = (completion: PortalPageCompletion, unavailable = false) => <QueryClientProvider client={client}>
    <Harness canonical="/staff/contacts" href="/staff/contacts" leaf={
      <PortalGuardedPage pathname="/staff/contacts" completion={completion} unavailable={unavailable}>
        <ContactsIndexClient />
      </PortalGuardedPage>} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui(denied)); await settle();
  expect(view.container.textContent).toContain('Private fictional contact');
  view.rerender(ui({}, true)); await settle();
  act(() => view.container.querySelector<HTMLButtonElement>('[data-cancel-selection]')!.click());
  view.rerender(ui(denied)); await settle();
  expect(view.container.textContent).not.toContain('Private fictional contact');
  expect(view.container.querySelector('[href="/staff/contacts/new"]')).toBeNull();
  expect(client.getQueryCache().find({ queryKey: contactsIndexQueryOptions().queryKey })!.getObserversCount()).toBe(0);
  act(() => view.container.querySelector('button')!.click()); await settle();
  view.rerender(ui(denied)); await settle();
  expect(view.container.textContent).not.toContain('Private fictional contact');
  view.rerender(ui(fresh)); await settle();
  expect(view.container.textContent).toContain('Private fictional contact');
  expect(view.container.querySelector('[href="/staff/contacts/new"]')).not.toBeNull();
  view.rerender(ui(denied)); await settle();
  expect(view.container.textContent).not.toContain('Private fictional contact');
  expect(client.getQueryCache().find({ queryKey: contactsIndexQueryOptions().queryKey })!.getObserversCount()).toBe(0);
  view.rerender(ui(fresh)); await settle();
  expect(view.container.textContent).toContain('Private fictional contact');
  view.unmount();
});

it('blocks the current completion during same-source refresh without treating it as explicit denial', async () => {
  const current = {}, fresh = {};
  window.history.replaceState(null, '', '/staff/contacts');
  const ui = (completion: PortalPageCompletion) => <QueryClientProvider client={client}>
    <Harness canonical="/staff/contacts" href="/staff/contacts" leaf={
      <PortalGuardedPage pathname="/staff/contacts" completion={completion}><ContactsIndexClient /></PortalGuardedPage>} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui(current)); await settle();
  const input = view.container.querySelector('#contactSearch');
  act(() => view.container.querySelector('button')!.click()); await settle();
  view.rerender(ui(current)); await settle();
  expect(view.container.textContent).not.toContain('Private fictional contact');
  expect(view.container.querySelector('[href="/staff/contacts/new"]')).toBeNull();
  // Cancelling this ordinary refresh retains the existing valid source.
  act(() => view.container.querySelector<HTMLButtonElement>('[data-cancel-selection]')!.click()); await settle();
  expect(view.container.textContent).toContain('Private fictional contact');
  act(() => view.container.querySelector('button')!.click()); await settle();
  expect(view.container.textContent).not.toContain('Private fictional contact');
  view.rerender(ui(fresh)); await settle();
  expect(view.container.textContent).toContain('Private fictional contact');
  expect(view.container.querySelector('#contactSearch')).toBe(input);
  view.unmount();
});

it('does not revoke outgoing Contacts A when pending Schedule B fails or let a wrong-canonical late B completion adopt', async () => {
  const a = {}, b = {};
  window.history.replaceState(null, '', '/staff/contacts');
  const ui = (deniedB: boolean) => <QueryClientProvider client={client}>
    <Harness canonical="/staff/contacts" href="/staff/schedule" leaf={<>
      <PortalGuardedPage pathname="/staff/contacts" completion={a}><ContactsIndexClient /></PortalGuardedPage>
      <PortalGuardedPage pathname="/staff/schedule" completion={b} unavailable={deniedB}>
        <p data-late-schedule>Late private Schedule evidence</p>
      </PortalGuardedPage>
    </>} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui(false)); await settle();
  expect(view.container.textContent).toContain('Private fictional contact');
  act(() => view.container.querySelector('button')!.click()); await settle();
  view.rerender(ui(true)); await settle();
  expect(view.container.textContent).toContain('Schedule unavailable');
  expect(view.container.textContent).not.toContain('Private fictional contact');
  act(() => view.container.querySelector<HTMLButtonElement>('[data-cancel-selection]')!.click()); await settle();
  expect(view.container.textContent).toContain('Private fictional contact');
  expect(view.container.querySelector('[href="/staff/contacts/new"]')).not.toBeNull();
  view.rerender(ui(false)); await settle();
  expect(view.container.querySelector('[data-late-schedule]')).toBeNull();
  expect(view.container.textContent).toContain('Private fictional contact');
  view.unmount();
});

it('restores the retained canonical source when pending navigation is cancelled before adoption', async () => {
  const completion = {};
  const dashboard = <PortalGuardedPage pathname="/dashboard" completion={completion}><PrivateDashboard /></PortalGuardedPage>;
  const view = renderIntoDocument(<QueryClientProvider client={client}>
    <Harness canonical="/dashboard" leaf={dashboard} />
  </QueryClientProvider>);
  act(() => view.container.querySelector('button')!.click()); await settle();
  expect(privateMounts).toBe(0);
  act(() => view.container.querySelector<HTMLButtonElement>('[data-cancel-selection]')!.click()); await settle();
  expect(window.location.pathname).toBe('/dashboard');
  expect(privateMounts).toBe(1);
  expect(view.container.querySelector('h1')?.textContent).toBe('Dashboard');
  expect(api).not.toHaveBeenCalled();
  view.unmount();
});

it('lets the adopted genuine Site Visits variant release a pending Board frame on the same pathname', async () => {
  const dashboard = <PortalGuardedPage pathname="/dashboard" completion={{}}><PrivateDashboard /></PortalGuardedPage>;
  const ui = (canonical: string, leaf: ReactNode) => <QueryClientProvider client={client}>
    <Harness canonical={canonical} href="/staff/schedule?view=board" leaf={leaf} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui('/dashboard', dashboard));
  act(() => view.container.querySelector('button')!.click()); await settle();
  act(() => window.history.replaceState(null, '', '/staff/schedule?view=site-visits'));
  view.rerender(ui('/staff/schedule', <PortalGuardedPage pathname="/staff/schedule" completion={{}} publicFrame={false}>
    <section data-actual-site-visits>Actual existing Site Visits owner</section>
  </PortalGuardedPage>));
  await settle();
  expect(view.container.querySelector('[data-actual-site-visits]')).not.toBeNull();
  expect(view.container.querySelector('[data-ui-foundation-consumer="schedule"]')).toBeNull();
  view.unmount();
});

it('preserves the verified canonical A source on accepted A→held B→A reversion without treating context changes as adoption', async () => {
  const completion = {};
  window.history.replaceState(null, '', '/staff/contacts');
  const leaf = <PortalGuardedPage pathname="/staff/contacts" completion={completion}><ContactsIndexClient /></PortalGuardedPage>;
  const ui = (href: string) => <QueryClientProvider client={client}>
    <Harness canonical="/staff/contacts" href={href} leaf={leaf} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui('/staff/schedule?view=board')); await settle();
  expect(view.container.textContent).toContain('Private fictional contact');
  act(() => view.container.querySelector('button')!.click()); await settle();
  expect(view.container.textContent).not.toContain('Private fictional contact');
  expect(client.getQueryCache().find({ queryKey: contactsIndexQueryOptions().queryKey })!.getObserversCount()).toBe(0);
  view.rerender(ui('/staff/contacts')); await settle();
  expect(view.container.textContent).not.toContain('Private fictional contact');
  act(() => view.container.querySelector('button')!.click()); await settle();
  expect(window.location.pathname).toBe('/staff/contacts');
  expect(view.container.textContent).toContain('Private fictional contact');
  expect(client.getQueryCache().find({ queryKey: contactsIndexQueryOptions().queryKey })!.getObserversCount()).toBe(1);
  view.unmount();
});

it('follows a later same-page search URL after the guarded handoff instead of pinning the entry href', async () => {
  const dashboard = <PortalGuardedPage pathname="/dashboard" completion={{}}><PrivateDashboard /></PortalGuardedPage>;
  const ui = (canonical: string, leaf: ReactNode) => <QueryClientProvider client={client}>
    <Harness canonical={canonical} leaf={leaf} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui('/dashboard', dashboard));
  act(() => view.container.querySelector('button')!.click()); await settle();
  view.rerender(ui('/staff/contacts', <PortalGuardedPage pathname="/staff/contacts" completion={{}}>
    <ContactsIndexClient />
  </PortalGuardedPage>));
  await settle();
  const input = view.container.querySelector<HTMLInputElement>('#contactSearch')!;
  act(() => window.history.replaceState(null, '', '/staff/contacts?q=B'));
  view.rerender(ui('/staff/contacts', <PortalGuardedPage pathname="/staff/contacts" completion={{}}>
    <ContactsIndexClient initialQuery="B" />
  </PortalGuardedPage>));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 220)); });
  expect(view.container.querySelector('#contactSearch')).toBe(input);
  expect(input.value).toBe('B');
  expect(api.mock.calls.at(-1)?.[0]).toContain('q=B');
  expect(view.container.textContent).not.toContain('Private fictional contact');
  view.unmount();
});

it.each([true, false])('keeps the pending frame collapse choice through the first genuine read for empty=%s', async empty => {
  window.history.replaceState(null, '', '/staff/schedule?view=board');
  const snapshot = progressiveScheduleSnapshot();
  const read = vi.fn(async () => ({ ...snapshot, unscheduledJobs: empty ? [] : snapshot.unscheduledJobs }));
  const view = renderIntoDocument(<QueryClientProvider client={client}>
    <Harness canonical="/staff/schedule" leaf={<PortalGuardedPage pathname="/staff/schedule" completion={{}}>
      <ScheduleClient snapshotLoaders={{ board: read, gantt: read }} />
    </PortalGuardedPage>} />
  </QueryClientProvider>);
  onTestFinished(() => view.unmount());
  await settle(); await settle();
  expect(read).toHaveBeenCalledTimes(1);
  const panel = view.container.querySelector('aside[aria-label="Unscheduled jobs"]')!;
  expect(panel.getAttribute('data-collapsed')).toBe('true');
  expect(view.container.querySelector('[aria-expanded][aria-label$="unscheduled panel"]')?.getAttribute('aria-expanded')).toBe('false');
  expect(panel.querySelector('h2')?.parentElement?.querySelector('span')?.textContent).toBe(String(empty ? 0 : snapshot.unscheduledJobs.length));
  if (empty) expect(panel.textContent).toContain('No unscheduled deposit-stage projects');
  else expect(panel.querySelector('[data-schedule-card-id]')).not.toBeNull();
});

it('preserves a collapse choice made after private props publish while the genuine Board read is held', async () => {
  window.history.replaceState(null, '', '/staff/schedule?view=board');
  let resolveRead!: (value: ReturnType<typeof progressiveScheduleSnapshot>) => void;
  const read = vi.fn(() => new Promise<ReturnType<typeof progressiveScheduleSnapshot>>(resolve => { resolveRead = resolve; }));
  const view = renderIntoDocument(<QueryClientProvider client={client}>
    <Harness canonical="/staff/schedule" leaf={<PortalGuardedPage pathname="/staff/schedule" completion={{}}>
      <ScheduleClient snapshotLoaders={{ board: read, gantt: read }} />
    </PortalGuardedPage>} />
  </QueryClientProvider>);
  onTestFinished(() => view.unmount());
  await settle(); await settle();
  expect(read).toHaveBeenCalledTimes(1);
  // Real private runtime/props exist, but there are no verified record rows yet.
  expect(document.querySelectorAll('[id^="DndDescribedBy-"]')).toHaveLength(1);
  expect(view.container.querySelector('[data-schedule-card-id]')).toBeNull();
  const toggle = view.container.querySelector<HTMLButtonElement>('[aria-expanded][aria-label$="unscheduled panel"]')!;
  const panel = view.container.querySelector('aside[aria-label="Unscheduled jobs"]');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  act(() => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  act(() => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  await act(async () => resolveRead(progressiveScheduleSnapshot()));
  await settle();
  expect(view.container.querySelector('[data-schedule-card-id]')).not.toBeNull();
  expect(view.container.querySelector('aside[aria-label="Unscheduled jobs"]')).toBe(panel);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  // Genuine empty records update the count/content without overwriting the
  // user's explicit panel choice or moving the workspace controls.
  act(() => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  read.mockResolvedValueOnce({ ...progressiveScheduleSnapshot(), unscheduledJobs: [] });
  await act(async () => { await client.refetchQueries(); });
  await settle();
  expect(read).toHaveBeenCalledTimes(2);
  expect(view.container.querySelector('aside[aria-label="Unscheduled jobs"]')).toBe(panel);
  expect(view.container.querySelector('[aria-expanded][aria-label$="unscheduled panel"]')).toBe(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(panel?.querySelector('h2')?.parentElement?.querySelector('span')?.textContent).toBe('0');
  expect(panel?.textContent).toContain('No unscheduled deposit-stage projects');
  act(() => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});

it('preserves a choice made after an initial unavailable read through the actual Retry recovery', async () => {
  window.history.replaceState(null, '', '/staff/schedule?view=board');
  client.setDefaultOptions({ queries: { retry: false, retryDelay: 0 } });
  const read = vi.fn<() => Promise<ReturnType<typeof progressiveScheduleSnapshot>>>()
    .mockRejectedValue(new Error('Fictional initial read unavailable'));
  const view = renderIntoDocument(<QueryClientProvider client={client}>
    <Harness canonical="/staff/schedule" leaf={<PortalGuardedPage pathname="/staff/schedule" completion={{}}>
      <ScheduleClient snapshotLoaders={{ board: read, gantt: read }} />
    </PortalGuardedPage>} />
  </QueryClientProvider>);
  onTestFinished(() => view.unmount());
  await settle(); await settle();
  const retry = [...view.container.querySelectorAll('button')].find(button => button.textContent === 'Retry')!;
  expect(retry).toBeDefined();
  expectScheduleReadFailure(view.container, 'Fictional initial read unavailable');
  expect(view.container.querySelector('[data-schedule-card-id]')).toBeNull();
  const toggle = view.container.querySelector<HTMLButtonElement>('[aria-expanded][aria-label$="unscheduled panel"]')!;
  const panel = view.container.querySelector('aside[aria-label="Unscheduled jobs"]');
  act(() => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  act(() => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(read).toHaveBeenCalledTimes(2);
  read.mockResolvedValue(progressiveScheduleSnapshot());
  act(() => retry.click());
  await settle(); await settle();
  expect(read).toHaveBeenCalledTimes(3);
  expect(view.container.querySelector('[data-schedule-card-id]')).not.toBeNull();
  expect(view.container.querySelector('aside[aria-label="Unscheduled jobs"]')).toBe(panel);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});

it.each(['pending', 'first-error'] as const)('keeps Gantt View unscheduled jobs intent through %s evidence and empty Board adoption', async phase => {
  const empty = { ...progressiveScheduleSnapshot(), unscheduledJobs: [] };
  const board = vi.fn(async () => empty);
  const gantt = vi.fn(async () => { throw new Error('Fictional Gantt unavailable'); });
  client.setDefaultOptions({ queries: { retry: false, retryDelay: 0 } });
  const dashboard = <PortalGuardedPage pathname="/dashboard" completion={{}}><PrivateDashboard /></PortalGuardedPage>;
  const ui = (canonical: string, leaf: ReactNode) => <QueryClientProvider client={client}>
    <Harness canonical={canonical} href="/staff/schedule?view=gantt" leaf={leaf} />
  </QueryClientProvider>;
  const view = renderIntoDocument(ui('/dashboard', dashboard));
  onTestFinished(() => view.unmount());
  act(() => view.container.querySelector('button')!.click()); await settle();
  if (phase === 'first-error') {
    await act(async () => view.rerender(ui('/staff/schedule', <PortalGuardedPage pathname="/staff/schedule" completion={{}}>
      <ScheduleClient initialSeedKind="gantt" snapshotLoaders={{ board, gantt }} />
    </PortalGuardedPage>)));
    await settle(); await settle();
    expectScheduleReadFailure(view.container, 'Fictional Gantt unavailable');
  }
  const open = [...view.container.querySelectorAll('button')].find(button => button.textContent === 'View unscheduled jobs')!;
  expect(open.disabled).toBe(false);
  act(() => open.click()); await settle();
  expect(new URL(window.location.href).searchParams.get('view')).toBe('board');
  if (phase === 'pending') {
    expect(board).not.toHaveBeenCalled();
    await act(async () => view.rerender(ui('/staff/schedule', <PortalGuardedPage pathname="/staff/schedule" completion={{}}>
      <ScheduleClient initialSeedKind="board" snapshotLoaders={{ board, gantt }} />
    </PortalGuardedPage>)));
  }
  await settle(); await settle();
  expect(board).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.getAttribute('data-collapsed')).toBe('false');
  expect(view.container.textContent).toContain('No unscheduled deposit-stage projects');
});


it.each(['/staff/contacts', '/staff/projects/proj_B'])('correlates unavailable leaf identities before adoption without poisoning unrelated or recovered owners for %s', pathB => {
  const pathA = '/dashboard';
  const tokenA = {}, deniedB = {}, freshB = {}, retired = {};
  let current!: ReturnType<typeof usePortalPageSourceController>;
  function Probe({ pathname, canonical, unavailable, completion }: { pathname: string; canonical: string; unavailable?: boolean; completion: Record<string, never> }) {
    current = usePortalPageSourceController(pathname, canonical, '');
    return <PortalPageSourceProvider value={current}><PortalGuardedPage pathname={pathB} completion={completion}
      unavailable={unavailable}><span data-private-B/></PortalGuardedPage></PortalPageSourceProvider>;
  }
  const view = renderIntoDocument(<Probe pathname={pathA} canonical={pathA} completion={deniedB}/>);
  onTestFinished(() => view.unmount());
  act(() => current.register({ pathname: pathA, completion: tokenA }));
  act(() => current.begin(pathB));
  // B fails while A remains canonical and B has never registered/adopted.
  view.rerender(<Probe pathname={pathB} canonical={pathA} completion={deniedB} unavailable/>);
  expect(current.attempt?.unavailable).toBe(true);
  act(() => current.begin(pathA));
  view.rerender(<Probe pathname={pathA} canonical={pathA} completion={deniedB}/>);
  expect(current.allowed({ pathname: pathA, completion: tokenA })).toBe(true);
  act(() => current.cancel());
  view.rerender(<Probe pathname={pathA} canonical={pathA} completion={deniedB}/>);
  expect(current.allowed({ pathname: pathA, completion: tokenA })).toBe(true);
  // A cached unavailable leaf stays truthfully unavailable after cancel/Back,
  // rather than becoming a pending frame with no genuine owner/read.
  view.rerender(<Probe pathname={pathB} canonical={pathB} completion={deniedB} unavailable/>);
  expect(current.attempt?.unavailable).toBe(true);
  act(() => current.cancel());
  view.rerender(<Probe pathname={pathA} canonical={pathA} completion={deniedB}/>);
  // Rebegin/cached Back cannot make the explicit denied B identity positive.
  act(() => current.begin(pathB));
  view.rerender(<Probe pathname={pathB} canonical={pathB} completion={deniedB}/>);
  expect(view.container.querySelector('[data-private-B]')).toBeNull();
  expect(current.allowed({ pathname: pathB, completion: deniedB })).toBe(false);
  view.rerender(<Probe pathname={pathB} canonical={pathB} completion={freshB}/>);
  expect(view.container.querySelector('[data-private-B]')).not.toBeNull();
  expect(current.allowed({ pathname: pathB, completion: freshB })).toBe(true);
  // A late repeat of the known-denied gate cannot revoke the newer B owner.
  act(() => current.deny(pathB, deniedB));
  expect(current.allowed({ pathname: pathB, completion: freshB })).toBe(true);
  // A stale wrong-path gate cannot steer current B or poison an unrelated token.
  act(() => current.deny(pathA, retired));
  expect(current.selectedPath).toBe(pathB);
  expect(current.allowed({ pathname: pathB, completion: freshB })).toBe(true);
});

it('limits project intent to the same existing nonblank detail identity without expanding public frame paths', () => {
  const base = 'https://portal.example.test/staff/projects';
  for (const href of ['https://foreign.example.test/staff/projects/proj_A', '/api/staff/v1/projects/proj_A', '/staff/projects/%20%20',
    '/staff/projects/%6eew', '/staff/projects/work-queue', '/staff/projects/proj_A/estimate/est_1', 'http://[']) expect(projectDetailPath(href, base)).toBeNull();
  expect(projectDetailPath('/staff/projects/proj_A?tab=files#details', base)).toBe('/staff/projects/proj_A');
  expect(projectDetailPath('/staff/projects/%20proj_A', base)).toBe('/staff/projects/%20proj_A');
});


it.each([
  ['/dashboard?from=projects#top', '/dashboard', null],
  ['/staff/projects', '/staff/projects', null],
  ['/staff/contacts', '/staff/contacts', null],
  ['/staff/projects/work-queue', '/staff/projects/work-queue', null],
  ['/staff/projects/design-packages', '/staff/projects/design-packages', null],
  ['/staff/projects/running-jobs', '/staff/projects/running-jobs', null],
  ['/staff/schedule?view=GANTT', '/staff/schedule', null],
  ['/staff/schedule?view=%20Site-Visits%20', null, null],
  ['/', null, null], ['/schedule', null, null], ['/staff/running-jobs', null, null], ['/staff/calculator', null, null],
  ['/staff/projects/%20proj_A?tab=files#details', null, '/staff/projects/%20proj_A'],
  ['/staff/projects/%20%20', null, null], ['/staff/projects/%E0%A4%A', null, null],
  ['/staff/projects/%6eew', null, null], ['/staff/projects/%77ork-queue', null, null],
  ['/staff/projects/design%2Dpackages', null, null], ['/staff/projects/running%2Djobs', null, null],
  ['/staff/projects/proj_A/estimate/est_1', null, null], ['/api/staff/v1/projects/proj_A', null, null],
  ['https://foreign.test/staff/projects/proj_A', null, null], ['http://[', null, null],
])('keeps Source selection policy separate from route aliases for %s', (href, frame, detail) => {
  const base = 'https://portal.test/staff/projects';
  expect(publicFramePath(href, base)).toBe(frame);
  expect(projectDetailPath(href, base)).toBe(detail);
  expect(publicFramePath(href, 'http://[')).toBeNull();
  expect(projectDetailPath(href, 'http://[')).toBeNull();
});

it('resolves an accepted detail selection once without weakening the fresh completion boundary', () => {
  const NativeURL = URL;
  let constructions = 0;
  let current!: ReturnType<typeof usePortalPageSourceController>;
  function Probe() { current = usePortalPageSourceController('/dashboard', '/dashboard', ''); return null; }
  const view = renderIntoDocument(<Probe/>);
  onTestFinished(() => view.unmount());
  const outgoing = {}, pending = {};
  act(() => current.register({ pathname: '/dashboard', completion: outgoing }));
  vi.stubGlobal('URL', class extends NativeURL {
    constructor(url: string | URL, base?: string | URL) { super(url, base); constructions++; }
  });
  try {
    act(() => { expect(current.begin('/staff/projects/proj_A?tab=files#details')).toBe(true); });
    expect(constructions).toBe(2); // one base URL and one destination, not a second detail parse
    expect(current.selectedPath).toBe('/staff/projects/proj_A');
    expect(current.href).toBe('/staff/projects/proj_A?tab=files#details');
    expect(current.owner).toBeNull();
    expect(current.allowed({ pathname: '/dashboard', completion: outgoing })).toBe(false);
    expect(current.allowed({ pathname: '/staff/projects/proj_A', completion: pending })).toBe(false);
  } finally { vi.unstubAllGlobals(); }
});
