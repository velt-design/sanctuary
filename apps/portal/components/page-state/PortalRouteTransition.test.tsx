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

function Trigger({ href, show }: { href: string; show?: 'delayed' | 'immediate' }) {
  const { beginRouteTransition } = usePortalRouteTransition();

  return (
    <button type="button" onClick={() => beginRouteTransition({ href, label: 'Projects', source: 'test', show })}>
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

  it('delays the blueprint overlay and keeps it briefly visible after the route changes', () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/projects" />
      </PortalRouteTransitionProvider>,
    );

    act(() => {
      rendered.container.querySelector('button')?.click();
      vi.advanceTimersByTime(159);
    });
    expect(rendered.container.textContent).not.toContain('Preparing workspace...');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(rendered.container.textContent).toContain('Preparing workspace...');

    mockPathname = '/staff/projects';
    window.history.replaceState({}, '', '/staff/projects');
    rendered.rerender(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/projects" />
      </PortalRouteTransitionProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(449);
    });
    expect(rendered.container.textContent).toContain('Preparing workspace...');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(rendered.container.textContent).not.toContain('Preparing workspace...');

    rendered.unmount();
  });

  it('cancels the delayed overlay when navigation completes quickly', () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/projects" />
      </PortalRouteTransitionProvider>,
    );

    act(() => {
      rendered.container.querySelector('button')?.click();
      vi.advanceTimersByTime(80);
    });

    mockPathname = '/staff/projects';
    window.history.replaceState({}, '', '/staff/projects');
    rendered.rerender(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/projects" />
      </PortalRouteTransitionProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(rendered.container.textContent).not.toContain('Preparing workspace...');

    rendered.unmount();
  });

  it('shows the blueprint overlay immediately when requested', () => {
    const rendered = renderIntoDocument(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/schedule?view=gantt" show="immediate" />
      </PortalRouteTransitionProvider>,
    );

    act(() => {
      rendered.container.querySelector('button')?.click();
    });
    expect(rendered.container.textContent).toContain('Preparing workspace...');

    mockPathname = '/staff/schedule';
    mockSearchParams = new URLSearchParams('view=gantt');
    window.history.replaceState({}, '', '/staff/schedule?view=gantt');
    rendered.rerender(
      <PortalRouteTransitionProvider>
        <Trigger href="/staff/schedule?view=gantt" show="immediate" />
      </PortalRouteTransitionProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(449);
    });
    expect(rendered.container.textContent).toContain('Preparing workspace...');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(rendered.container.textContent).not.toContain('Preparing workspace...');

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
