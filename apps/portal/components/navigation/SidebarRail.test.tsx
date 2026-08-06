import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SidebarRail from './SidebarRail';
import { renderIntoDocument } from '../../../../test/reactHarness';

const transitionMocks = vi.hoisted(() => ({
  beginInstantRoute: vi.fn(),
  beginRouteTransition: vi.fn(),
  prefetchQuery: vi.fn(),
  routerPrefetch: vi.fn(),
  routerReplace: vi.fn(),
}));

let mockPathname = '/dashboard';

function preventDocumentNavigation(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('a')) event.preventDefault();
}

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ prefetch: transitionMocks.routerPrefetch, replace: transitionMocks.routerReplace }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    prefetchQuery: transitionMocks.prefetchQuery,
  }),
}));

vi.mock('@/lib/queries/schedule', () => ({
  scheduleV2SnapshotQueryOptions: (host: string, today: string) => ({
    queryKey: ['schedule-v2', host, today],
  }),
}));

vi.mock('./UserMenu', () => ({
  default: () => <div data-testid="mock-user-menu">User menu</div>,
}));

vi.mock('@/components/page-state/PortalRouteTransition', async () => {
  const actual = await vi.importActual<typeof import('@/components/page-state/PortalRouteTransition')>(
    '@/components/page-state/PortalRouteTransition',
  );

  return {
    ...actual,
    usePortalRouteTransition: () => ({
      beginInstantRoute: transitionMocks.beginInstantRoute,
      beginRouteTransition: transitionMocks.beginRouteTransition,
    }),
  };
});

function linkByLabel(container: HTMLElement, label: string): HTMLAnchorElement {
  const link = container.querySelector(`a[aria-label="${label}"]`);
  if (!(link instanceof HTMLAnchorElement)) throw new Error(`Link not found: ${label}`);
  return link;
}

describe('SidebarRail', () => {
  beforeEach(() => {
    transitionMocks.beginInstantRoute.mockReset();
    transitionMocks.beginRouteTransition.mockReset();
    transitionMocks.prefetchQuery.mockReset();
    transitionMocks.routerPrefetch.mockReset();
    transitionMocks.routerReplace.mockReset();
    mockPathname = '/dashboard';
    window.history.replaceState({}, '', '/dashboard');
    document.addEventListener('click', preventDocumentNavigation);
  });

  afterEach(() => {
    document.removeEventListener('click', preventDocumentNavigation);
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('opens Projects instantly without starting the blocking route transition', () => {
    const rendered = renderIntoDocument(<SidebarRail role="staff" />);

    linkByLabel(rendered.container, 'Projects').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );

    expect(window.location.pathname).toBe('/staff/projects');
    expect(transitionMocks.routerReplace).toHaveBeenCalledWith('/staff/projects', { scroll: false });
    expect(transitionMocks.beginInstantRoute).toHaveBeenCalledWith('projects-index');
    expect(transitionMocks.beginRouteTransition).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('opens canonical Contacts instantly without starting the blocking route transition', () => {
    const rendered = renderIntoDocument(<SidebarRail role="staff" />);

    linkByLabel(rendered.container, 'Contacts').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );

    expect(window.location.pathname).toBe('/staff/contacts');
    expect(transitionMocks.routerReplace).toHaveBeenCalledWith('/staff/contacts', { scroll: false });
    expect(transitionMocks.beginInstantRoute).toHaveBeenCalledWith('contacts-index');
    expect(transitionMocks.beginRouteTransition).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('does not start a loading transition for current-page icon clicks', () => {
    const rendered = renderIntoDocument(<SidebarRail role="staff" />);

    linkByLabel(rendered.container, 'Dashboard').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );

    expect(transitionMocks.beginRouteTransition).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('starts ordinary navigation progress on only the clicked control', () => {
    const rendered = renderIntoDocument(<SidebarRail role="staff" />);
    const scheduleLink = linkByLabel(rendered.container, 'Schedule');

    scheduleLink.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );

    expect(transitionMocks.beginRouteTransition).toHaveBeenCalledWith({
      href: '/schedule',
      label: 'Schedule',
      source: 'sidebar-rail',
      control: scheduleLink,
    });

    rendered.unmount();
  });

  it('prefetches ordinary routes only after navigation intent', () => {
    const rendered = renderIntoDocument(<SidebarRail role="staff" />);
    const scheduleLink = linkByLabel(rendered.container, 'Schedule');

    expect(transitionMocks.routerPrefetch).not.toHaveBeenCalled();

    act(() => {
      scheduleLink.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      scheduleLink.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });

    expect(transitionMocks.routerPrefetch).toHaveBeenCalledTimes(1);
    expect(transitionMocks.routerPrefetch).toHaveBeenCalledWith('/schedule');
    expect(transitionMocks.prefetchQuery).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });
});
