import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PortalInstantRouteContent,
  PortalRouteTransitionProvider,
  shouldStartRouteTransitionForHref,
  usePortalRouteTransition,
} from './PortalRouteTransition';
import { renderIntoDocument } from '../../../../test/reactHarness';

let mockPathname = '/dashboard';
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
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

function CompetingInstantRouteTrigger() {
  const { beginInstantRoute, finishInstantRoute } = usePortalRouteTransition();
  return (
    <div>
      <button type="button" onClick={() => beginInstantRoute('projects-index')}>Open projects</button>
      <button type="button" onClick={() => beginInstantRoute('contacts-index')}>Open contacts</button>
      <button type="button" onClick={() => finishInstantRoute('projects-index')}>Stale projects mounted</button>
      <button type="button" onClick={() => finishInstantRoute('contacts-index')}>Contacts mounted</button>
    </div>
  );
}

describe('PortalRouteTransitionProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPathname = '/dashboard';
    mockSearchParams = new URLSearchParams();
    window.history.replaceState({}, '', '/dashboard');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
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

  it('clears pending navigation immediately when browser history takes over', () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/projects" />
      </PortalRouteTransitionProvider>,
    );

    act(() => rendered.container.querySelector('button')?.click());
    expect(rendered.container.querySelector('[data-portal-route-progress="true"]')).not.toBeNull();

    act(() => window.dispatchEvent(new PopStateEvent('popstate')));

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

  it('shows the useful Projects frame synchronously and reveals mounted route content afterward', () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <InstantRouteTrigger />
        <PortalInstantRouteContent>
          <div data-testid="route-content">Dashboard content</div>
        </PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );
    const buttons = rendered.container.querySelectorAll('button');

    act(() => buttons[0]?.click());

    expect(rendered.container.querySelector('[data-projects-index-state="pending"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden')).toBe('true');
    expect(rendered.container.textContent).toContain('Updating projects');

    act(() => buttons[1]?.click());

    expect(rendered.container.querySelector('[data-projects-index-state="pending"]')).toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden')).toBeNull();
    expect(rendered.container.textContent).toContain('Dashboard content');

    rendered.unmount();
  });

  it('shows the useful Contacts frame synchronously and reveals mounted content afterward', () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <ContactsInstantRouteTrigger />
        <PortalInstantRouteContent><div>Dashboard content</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );
    const buttons = rendered.container.querySelectorAll('button');
    act(() => buttons[0]?.click());
    expect(rendered.container.querySelector('[data-contacts-index-state="pending"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Updating contacts');
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden')).toBe('true');
    act(() => buttons[1]?.click());
    expect(rendered.container.querySelector('[data-contacts-index-state="pending"]')).toBeNull();
    expect(rendered.container.textContent).toContain('Dashboard content');
    rendered.unmount();
  });

  it('ignores a stale client-mounted completion after a newer instant route starts', () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <CompetingInstantRouteTrigger />
        <PortalInstantRouteContent><div>Current content</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );
    const buttons = rendered.container.querySelectorAll('button');

    act(() => buttons[0]?.click());
    act(() => buttons[1]?.click());
    act(() => buttons[2]?.click());

    expect(rendered.container.querySelector('[data-contacts-index-state="pending"]')).not.toBeNull();

    act(() => buttons[3]?.click());
    expect(rendered.container.querySelector('[data-contacts-index-state="pending"]')).toBeNull();
    rendered.unmount();
  });

  it('shows a truthful generic route shell immediately and releases it when the route commits', () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/schedule" />
        <PortalInstantRouteContent><div>Dashboard content</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    act(() => rendered.container.querySelector('button')?.click());

    expect(rendered.container.querySelector('[data-portal-instant-shell="schedule"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Schedule');
    expect(rendered.container.textContent).toContain('Updating crews');
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden')).toBe('true');

    mockPathname = '/staff/schedule';
    window.history.replaceState({}, '', '/staff/schedule');
    rendered.rerender(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/schedule" />
        <PortalInstantRouteContent><div>Schedule content</div></PortalInstantRouteContent>
      </PortalRouteTransitionProvider>,
    );

    expect(rendered.container.querySelector('[data-portal-instant-shell="schedule"]')).toBeNull();
    expect(rendered.container.querySelector('[data-portal-route-content]')?.getAttribute('aria-hidden')).toBeNull();
    expect(rendered.container.textContent).toContain('Schedule content');
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
