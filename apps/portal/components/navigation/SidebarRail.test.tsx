import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SidebarRail from './SidebarRail';
import { renderIntoDocument } from '../../../../test/reactHarness';

const transitionMocks = vi.hoisted(() => ({
  beginRouteTransition: vi.fn(),
  prefetchQuery: vi.fn(),
}));

let mockPathname = '/dashboard';

function preventDocumentNavigation(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('a')) event.preventDefault();
}

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    prefetchQuery: transitionMocks.prefetchQuery,
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
    transitionMocks.beginRouteTransition.mockReset();
    transitionMocks.prefetchQuery.mockReset();
    mockPathname = '/dashboard';
    window.history.replaceState({}, '', '/dashboard');
    document.addEventListener('click', preventDocumentNavigation);
  });

  afterEach(() => {
    document.removeEventListener('click', preventDocumentNavigation);
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('starts route transitions from icon clicks', () => {
    const rendered = renderIntoDocument(<SidebarRail role="staff" />);

    linkByLabel(rendered.container, 'Projects').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );

    expect(transitionMocks.beginRouteTransition).toHaveBeenCalledWith({
      href: '/projects',
      label: 'Projects',
      source: 'sidebar-rail',
    });

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
});
