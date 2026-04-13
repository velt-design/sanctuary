import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
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

function Trigger({ href }: { href: string }) {
  const { beginRouteTransition } = usePortalRouteTransition();

  return (
    <button type="button" onClick={() => beginRouteTransition({ href, label: 'Projects', source: 'test' })}>
      Start
    </button>
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
