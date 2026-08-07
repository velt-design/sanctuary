import { act, useEffect, type ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PortalInstantRouteContent,
  PortalRouteTransitionProvider,
  shouldStartRouteTransitionForHref,
  usePortalRouteTransition,
} from './PortalRouteTransition';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { PORTAL_NAVIGATION_INTENT_EVENT } from '@/lib/portalNavigationIntent';

let mockPathname = '/dashboard';
let mockSearchParams = new URLSearchParams();
const originalNavigatorOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine');
const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: online,
  });
}

async function settlePreloadedExactFrame() {
  await import('./PortalExactRouteFrame');
  await Promise.resolve();
}

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: navigationMocks.push, replace: navigationMocks.replace }),
}));

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function Trigger({ href, initiallyBusy = false }: { href: string; initiallyBusy?: boolean }) {
  const { beginRouteTransition } = usePortalRouteTransition();

  return (
    <button
      type="button"
      aria-busy={initiallyBusy || undefined}
      onClick={(event) =>
        beginRouteTransition({ href, label: 'Projects', source: 'test', control: event.currentTarget })
      }
    >
      Start
    </button>
  );
}

function InstantRouteTrigger() {
  const { beginInstantRoute, finishInstantRoute } = usePortalRouteTransition();
  return (
    <div>
      <button type="button" onClick={() => beginInstantRoute('projects-index')}>Open projects</button>
      <button type="button" onClick={() => finishInstantRoute('projects-index')}>Projects mounted</button>
    </div>
  );
}

function ContactsInstantRouteTrigger() {
  const { beginInstantRoute, finishInstantRoute } = usePortalRouteTransition();
  return (
    <div>
      <button type="button" onClick={() => beginInstantRoute('contacts-index')}>Open contacts</button>
      <button type="button" onClick={() => finishInstantRoute('contacts-index')}>Contacts mounted</button>
    </div>
  );
}

function ProgrammaticRouteTrigger({ href = '/staff/projects/new' }: { href?: string }) {
  const { navigateRoute } = usePortalRouteTransition();
  return (
    <button
      type="button"
      onClick={() => navigateRoute({ href, source: 'test-button' })}
    >
      Programmatic navigation
    </button>
  );
}

function TransitionStateProbe() {
  const { pendingHref } = usePortalRouteTransition();
  return <output data-testid="pending-href">{pendingHref}</output>;
}

function BlockPortalNavigation() {
  useEffect(() => {
    const block = (event: Event) => event.preventDefault();
    document.addEventListener(PORTAL_NAVIGATION_INTENT_EVENT, block);
    return () => document.removeEventListener(PORTAL_NAVIGATION_INTENT_EVENT, block);
  }, []);
  return null;
}

describe('PortalRouteTransitionProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPathname = '/dashboard';
    mockSearchParams = new URLSearchParams();
    navigationMocks.push.mockReset();
    navigationMocks.replace.mockReset();
    window.history.replaceState({}, '', '/dashboard');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
    if (originalNavigatorOnline) {
      Object.defineProperty(navigator, 'onLine', originalNavigatorOnline);
    } else {
      Reflect.deleteProperty(navigator, 'onLine');
    }
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('shows non-blocking progress immediately and marks only the clicked control busy', () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/projects" />
        <button type="button">Other action</button>
      </PortalRouteTransitionProvider>,
    );
    const buttons = rendered.container.querySelectorAll('button');

    act(() => {
      buttons[0]?.click();
    });
    expect(rendered.container.querySelector('[data-portal-route-progress="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Page loading"]')).toBeNull();
    expect(buttons[0]?.getAttribute('aria-busy')).toBe('true');
    expect(buttons[0]?.getAttribute('data-portal-route-pending')).toBe('true');
    expect(buttons[1]?.getAttribute('aria-busy')).toBeNull();

    mockPathname = '/staff/projects';
    window.history.replaceState({}, '', '/staff/projects');
    rendered.rerender(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/projects" />
      </PortalRouteTransitionProvider>,
    );

    expect(rendered.container.querySelector('[data-portal-route-progress="true"]')).toBeNull();
    expect(buttons[0]?.getAttribute('aria-busy')).toBeNull();
    expect(buttons[0]?.getAttribute('data-portal-route-pending')).toBeNull();

    rendered.unmount();
  });

  it('clears progress and the clicked control if a transition never completes', () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/projects" />
      </PortalRouteTransitionProvider>,
    );

    act(() => {
      rendered.container.querySelector('button')?.click();
      vi.advanceTimersByTime(8000);
    });
    expect(rendered.container.querySelector('[data-portal-route-progress="true"]')).toBeNull();
    expect(rendered.container.querySelector('button')?.getAttribute('aria-busy')).toBeNull();

    rendered.unmount();
  });

  it('restores a clicked control existing busy state after navigation', () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/schedule?view=gantt" initiallyBusy />
      </PortalRouteTransitionProvider>,
    );

    act(() => {
      rendered.container.querySelector('button')?.click();
    });
    expect(rendered.container.querySelector('button')?.getAttribute('aria-busy')).toBe('true');

    mockPathname = '/staff/schedule';
    mockSearchParams = new URLSearchParams('view=gantt');
    window.history.replaceState({}, '', '/staff/schedule?view=gantt');
    rendered.rerender(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/schedule?view=gantt" initiallyBusy />
      </PortalRouteTransitionProvider>,
    );

    expect(rendered.container.querySelector('[data-portal-route-progress="true"]')).toBeNull();
    expect(rendered.container.querySelector('button')?.getAttribute('aria-busy')).toBe('true');
    expect(rendered.container.querySelector('button')?.getAttribute('data-portal-route-pending')).toBeNull();

    rendered.unmount();
  });

  it('shows the useful Projects frame from the post-auth preload and reveals mounted route content afterward', async () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <InstantRouteTrigger />
        <PortalInstantRouteContent>
          <div data-testid="route-content">Dashboard content</div>
        </PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );
    const buttons = rendered.container.querySelectorAll('button');

    await act(async () => {
      buttons[0]?.click();
      await settlePreloadedExactFrame();
    });

    expect(rendered.container.querySelector('[data-projects-index-state="pending"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden')).toBe('true');
    expect(rendered.container.textContent).toContain('Updating projects');

    act(() => buttons[1]?.click());

    expect(rendered.container.querySelector('[data-projects-index-state="pending"]')).toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden')).toBeNull();
    expect(rendered.container.textContent).toContain('Dashboard content');

    rendered.unmount();
  });

  it('shows the useful Contacts frame from the post-auth preload and reveals mounted content afterward', async () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <ContactsInstantRouteTrigger />
        <PortalInstantRouteContent><div>Dashboard content</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );
    const buttons = rendered.container.querySelectorAll('button');
    await act(async () => {
      buttons[0]?.click();
      await settlePreloadedExactFrame();
    });
    expect(rendered.container.querySelector('[data-contacts-index-state="pending"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Updating contacts');
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden')).toBe('true');
    act(() => buttons[1]?.click());
    expect(rendered.container.querySelector('[data-contacts-index-state="pending"]')).toBeNull();
    expect(rendered.container.textContent).toContain('Dashboard content');
    rendered.unmount();
  });

  it('starts the exact destination frame for ordinary internal portal links online', async () => {
    setNavigatorOnline(true);
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <a href="/staff/projects/new">New Project</a>
        <PortalInstantRouteContent><div>Projects content</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    await act(async () => {
      rendered.container
        .querySelector<HTMLAnchorElement>('a[href="/staff/projects/new"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      await settlePreloadedExactFrame();
    });

    expect(rendered.container.querySelector('[data-portal-page-shell="project-create"]'))
      .not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden'))
      .toBe('true');
    expect(rendered.container.querySelector('a')?.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement?.getAttribute('data-portal-route-focus-target')).toBe('true');
    rendered.unmount();
  });

  it('keeps the current page visible when an unsaved-work guard cancels a link', async () => {
    setNavigatorOnline(true);
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <BlockPortalNavigation />
        <a href="/staff/projects/new">New Project</a>
        <PortalInstantRouteContent><div>Unsaved editor content</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    await act(async () => {
      rendered.container
        .querySelector<HTMLAnchorElement>('a[href="/staff/projects/new"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-portal-page-shell="project-create"]')).toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-progress="true"]')).toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden'))
      .toBeNull();
    expect(rendered.container.textContent).toContain('Unsaved editor content');
    expect(rendered.container.querySelector('a')?.getAttribute('aria-busy')).toBeNull();
    rendered.unmount();
  });

  it('applies the same unsaved-work boundary to programmatic navigation', async () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <BlockPortalNavigation />
        <ProgrammaticRouteTrigger />
        <PortalInstantRouteContent><div>Unsaved editor content</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    act(() => rendered.container.querySelector('button')?.click());

    expect(rendered.container.querySelector('[data-portal-page-shell="project-create"]')).toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-progress="true"]')).toBeNull();
    expect(rendered.container.textContent).toContain('Unsaved editor content');
    rendered.unmount();
  });

  it('shows the complete preloaded Schedule frame immediately and releases it when the route commits', async () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/schedule" />
        <PortalInstantRouteContent><div>Dashboard content</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    await act(async () => {
      rendered.container.querySelector('button')?.click();
      await settlePreloadedExactFrame();
    });

    expect(rendered.container.querySelector('[data-portal-page-shell="schedule"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Schedule');
    expect(rendered.container.querySelector('[aria-label="Installer lanes"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden')).toBe('true');

    mockPathname = '/staff/schedule';
    window.history.replaceState({}, '', '/staff/schedule');
    rendered.rerender(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/schedule" />
        <PortalInstantRouteContent>
          <main data-portal-page-shell-ready="true"><h1>Schedule content</h1></main>
        </PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    expect(rendered.container.querySelector('[data-portal-page-shell="schedule"]')).toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden')).toBeNull();
    expect(rendered.container.textContent).toContain('Schedule content');
    expect(document.activeElement?.getAttribute('data-portal-page-shell-ready')).toBe('true');
    rendered.unmount();
  });

  it('keeps current route content visible for same-page query changes', () => {
    mockPathname = '/staff/schedule';
    mockSearchParams = new URLSearchParams('view=board');
    window.history.replaceState({}, '', '/staff/schedule?view=board');
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/schedule?view=gantt" />
        <PortalInstantRouteContent><div>Current schedule content</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    act(() => rendered.container.querySelector('button')?.click());

    expect(rendered.container.querySelector('[data-portal-route-progress="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-instant-shell]')).toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden')).toBeNull();
    expect(rendered.container.textContent).toContain('Current schedule content');
    rendered.unmount();
  });

  it('does not activate a portal frame when a React link handler cancels during bubbling', async () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <a href="/staff/projects/new" onClick={(event) => event.preventDefault()}>
          Canceled project
        </a>
        <PortalInstantRouteContent><main>Current page</main></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    await act(async () => {
      rendered.container.querySelector('a')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
      );
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-portal-page-shell="project-create"]')).toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-progress="true"]')).toBeNull();
    expect(rendered.container.textContent).toContain('Current page');
    rendered.unmount();
  });

  it('ignores aria-disabled portal links before starting a transition', () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <a href="/staff/projects/new" aria-disabled="true">Unavailable project</a>
        <PortalInstantRouteContent><main>Current page</main></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    act(() => {
      rendered.container.querySelector('a')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
      );
    });

    expect(rendered.container.querySelector('[data-portal-page-shell="project-create"]')).toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-progress="true"]')).toBeNull();
    rendered.unmount();
  });

  it('ends progress after eight seconds without losing the exact destination href', async () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/schedule?view=gantt" />
        <TransitionStateProbe />
        <PortalInstantRouteContent><main>Dashboard content</main></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    await act(async () => {
      rendered.container.querySelector('button')?.click();
      await settlePreloadedExactFrame();
      vi.advanceTimersByTime(8000);
    });

    expect(rendered.container.querySelector('[data-portal-route-progress="true"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="pending-href"]')?.textContent)
      .toBe('/staff/schedule?view=gantt');
    expect(rendered.container.querySelector('[data-schedule-view="gantt"]')).not.toBeNull();
    rendered.unmount();
  });

  it('navigates between exact preloaded page frames offline without waiting for a route response', async () => {
    setNavigatorOnline(false);
    window.history.replaceState({ __NA: true, retained: 'private-next-state' }, '', '/dashboard');
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <a href="/staff/projects">Projects</a>
        <PortalInstantRouteContent><div>Sensitive dashboard content</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );
    const link = rendered.container.querySelector<HTMLAnchorElement>('a[href="/staff/projects"]');

    await act(async () => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      await settlePreloadedExactFrame();
      vi.advanceTimersByTime(8000);
    });

    expect(window.location.pathname).toBe('/staff/projects');
    expect(window.history.state).toEqual({});
    expect(rendered.container.querySelector('[data-projects-index-state="pending"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-offline-shell-state="offline"]')).not.toBeNull();
    expect(document.activeElement?.getAttribute('data-portal-route-focus-target')).toBe('true');
    expect(rendered.container.textContent).toContain('Page structure is available');
    expect(rendered.container.textContent).not.toContain('Sensitive dashboard content');

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(rendered.container.querySelector('[data-portal-offline-shell-state="reconnected"]')).not.toBeNull();
    expect(
      rendered.container.querySelector<HTMLAnchorElement>(
        '[data-portal-offline-shell-state="reconnected"] a[href="/staff/projects"]',
      )?.textContent,
    ).toContain('Reload live data');
    rendered.unmount();
  });

  it('shows the exact Calculator frame for programmatic navigation offline without a router request', async () => {
    setNavigatorOnline(false);
    const href = '/staff/calculator?projectId=proj_1&openActiveDraft=1';
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <ProgrammaticRouteTrigger href={href} />
        <PortalInstantRouteContent>
          <div>Sensitive dashboard content</div>
        </PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    await act(async () => {
      rendered.container.querySelector('button')?.click();
      await settlePreloadedExactFrame();
    });

    expect(window.location.pathname).toBe('/staff/calculator');
    expect(window.location.search).toBe('?projectId=proj_1&openActiveDraft=1');
    expect(rendered.container.querySelector('[data-portal-page-shell="calculator"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-offline-shell-state="offline"]')).not.toBeNull();
    expect(rendered.container.textContent).not.toContain('Sensitive dashboard content');
    expect(navigationMocks.push).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('keeps project Calculator and Commercial subpages navigable inside the offline frame', async () => {
    setNavigatorOnline(false);
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <a href="/staff/projects/proj_1">Open project</a>
        <PortalInstantRouteContent><div>Projects content</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    await act(async () => {
      rendered.container
        .querySelector<HTMLAnchorElement>('a[href="/staff/projects/proj_1"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      await settlePreloadedExactFrame();
    });

    const tab = (name: string) => Array.from(
      rendered.container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((candidate) => candidate.textContent?.trim() === name);

    act(() => tab('Calculator')?.click());
    expect(window.location.search).toContain('tab=estimates');
    expect(rendered.container.querySelector('[data-portal-page-shell="project-calculator"]')).not.toBeNull();

    act(() => tab('Commercial')?.click());
    expect(window.location.search).toContain('tab=quotes');
    expect(rendered.container.querySelector('[data-project-commercial-view="quotes"]')).not.toBeNull();

    act(() => tab('Invoices')?.click());
    expect(window.location.search).toContain('tab=invoices');
    expect(rendered.container.querySelector('[data-portal-page-shell="invoice-list"]')).not.toBeNull();
    rendered.unmount();
  });

  it('keeps Gantt and Site Visits query routes structurally truthful offline', async () => {
    setNavigatorOnline(false);
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <a href="/staff/schedule?view=gantt">Gantt</a>
        <a href="/staff/schedule?view=site-visits">Site visits</a>
        <PortalInstantRouteContent><div>Dashboard data</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );
    const links = rendered.container.querySelectorAll<HTMLAnchorElement>('a');

    await act(async () => {
      links[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      await settlePreloadedExactFrame();
    });
    expect(rendered.container.querySelector('[data-schedule-view="gantt"]')).not.toBeNull();
    expect(rendered.container.querySelector('button[aria-pressed="true"]')?.textContent).toBe('Gantt');

    const scheduleViewButton = (name: string) => Array.from(
      rendered.container.querySelectorAll<HTMLButtonElement>(
        '[data-portal-page-shell="schedule"] button',
      ),
    ).find((candidate) => candidate.textContent?.trim() === name);

    expect(scheduleViewButton('Board')?.disabled).toBe(false);
    act(() => scheduleViewButton('Board')?.click());
    expect(window.location.pathname).toBe('/staff/schedule');
    expect(window.location.search).toBe('?view=board');
    expect(window.history.state).toEqual({});
    expect(rendered.container.querySelector('[data-schedule-view="board"]')).not.toBeNull();

    act(() => scheduleViewButton('Gantt')?.click());
    expect(window.location.search).toBe('?view=gantt');
    expect(rendered.container.querySelector('[data-schedule-view="gantt"]')).not.toBeNull();

    await act(async () => {
      links[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      await Promise.resolve();
    });
    expect(rendered.container.querySelector('[data-schedule-view="site-visits"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Unscheduled site visits"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Site visits week calendar"]')).not.toBeNull();

    expect(scheduleViewButton('Gantt')?.disabled).toBe(false);
    act(() => scheduleViewButton('Gantt')?.click());
    expect(window.location.search).toBe('?view=gantt');
    expect(rendered.container.querySelector('[data-schedule-view="gantt"]')).not.toBeNull();
    rendered.unmount();
  });
});

describe('shouldStartRouteTransitionForHref', () => {
  it('ignores current-page and hash-only hrefs', () => {
    const current = new URL('https://example.test/staff/projects?tab=jobs');

    expect(shouldStartRouteTransitionForHref('/staff/projects?tab=jobs', current)).toBe(false);
    expect(shouldStartRouteTransitionForHref('#materials', current)).toBe(false);
    expect(shouldStartRouteTransitionForHref('/staff/projects?tab=jobs#materials', current)).toBe(false);
    expect(shouldStartRouteTransitionForHref('/staff/projects?tab=estimates', current)).toBe(true);
  });
});
