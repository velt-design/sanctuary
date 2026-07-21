import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalSidebarPanel from './PortalSidebarPanel';
import { renderIntoDocument } from '../../../../test/reactHarness';

const transitionMocks = vi.hoisted(() => ({
  beginInstantRoute: vi.fn(),
  beginRouteTransition: vi.fn(),
  prefetchQuery: vi.fn(),
  routerPrefetch: vi.fn(),
  routerReplace: vi.fn(),
}));

let mockPathname = '/dashboard';
let mockSearchParams = new URLSearchParams();
let mockRole: 'admin' | 'staff' = 'staff';

function preventDocumentNavigation(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('a')) event.preventDefault();
}

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ prefetch: transitionMocks.routerPrefetch, replace: transitionMocks.routerReplace }),
}));

vi.mock('@/components/auth/PortalAuthProvider', () => ({
  usePortalSession: () => ({ email: 'ops@example.com', role: mockRole }),
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
      beginInstantRoute: transitionMocks.beginInstantRoute,
      beginRouteTransition: transitionMocks.beginRouteTransition,
    }),
  };
});

function renderSidebar() {
  return renderIntoDocument(<PortalSidebarPanel />);
}

function panelLayer(container: HTMLElement): HTMLElement {
  const panel = container.querySelector('[data-portal-sidebar-panel="true"]');
  const layer = panel?.firstElementChild;
  if (!(layer instanceof HTMLElement)) throw new Error('Sidebar panel layer not found.');
  return layer;
}

function linkByText(container: HTMLElement, text: string): HTMLAnchorElement {
  const link = Array.from(container.querySelectorAll('a')).find((node) => node.textContent?.trim() === text);
  if (!(link instanceof HTMLAnchorElement)) throw new Error(`Link not found: ${text}`);
  return link;
}

function linkByLabel(container: HTMLElement, label: string): HTMLAnchorElement {
  const link = container.querySelector(`a[aria-label="${label}"]`);
  if (!(link instanceof HTMLAnchorElement)) throw new Error(`Link not found: ${label}`);
  return link;
}

function queryLinkByText(container: HTMLElement, text: string): HTMLAnchorElement | null {
  const link = Array.from(container.querySelectorAll('a')).find((node) => node.textContent?.trim() === text);
  return link instanceof HTMLAnchorElement ? link : null;
}

function buttonByLabel(container: HTMLElement, label: string): HTMLButtonElement {
  const button = container.querySelector(`button[aria-label="${label}"]`);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`);
  return button;
}

describe('PortalSidebarPanel', () => {
  beforeEach(() => {
    transitionMocks.beginInstantRoute.mockReset();
    transitionMocks.beginRouteTransition.mockReset();
    transitionMocks.prefetchQuery.mockReset();
    transitionMocks.routerPrefetch.mockReset();
    transitionMocks.routerReplace.mockReset();
    mockPathname = '/dashboard';
    mockSearchParams = new URLSearchParams();
    mockRole = 'staff';
    window.history.replaceState({}, '', '/dashboard');
    document.addEventListener('click', preventDocumentNavigation);
  });

  afterEach(() => {
    document.removeEventListener('click', preventDocumentNavigation);
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('opens the active section and toggles multiple sections from chevrons', () => {
    mockPathname = '/staff/projects/design-packages';
    const rendered = renderSidebar();

    expect(panelLayer(rendered.container).getAttribute('aria-hidden')).toBe('false');
    expect(linkByText(rendered.container, 'Drafting Queue')).toBeInstanceOf(HTMLAnchorElement);
    expect(queryLinkByText(rendered.container, 'New Contact')).toBeNull();

    act(() => {
      buttonByLabel(rendered.container, 'Expand Contacts').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
      );
    });

    expect(linkByText(rendered.container, 'Drafting Queue')).toBeInstanceOf(HTMLAnchorElement);
    expect(linkByText(rendered.container, 'New Contact')).toBeInstanceOf(HTMLAnchorElement);
    expect(buttonByLabel(rendered.container, 'Collapse Contacts').getAttribute('aria-expanded')).toBe('true');

    act(() => {
      buttonByLabel(rendered.container, 'Collapse Contacts').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
      );
    });

    expect(linkByText(rendered.container, 'Drafting Queue')).toBeInstanceOf(HTMLAnchorElement);
    expect(queryLinkByText(rendered.container, 'New Contact')).toBeNull();

    rendered.unmount();
  });

  it('keeps each parent icon, label, and expanded submenu in one flow group', () => {
    mockPathname = '/staff/projects/design-packages';
    const rendered = renderSidebar();

    const projectsGroup = rendered.container.querySelector('[data-sidebar-parent-key="projects"]');
    const contactsGroup = rendered.container.querySelector('[data-sidebar-parent-key="contacts"]');
    if (!(projectsGroup instanceof HTMLElement) || !(contactsGroup instanceof HTMLElement)) {
      throw new Error('Expected projects and contacts sidebar groups.');
    }

    expect(projectsGroup.querySelector('a[aria-label="Projects"]')).toBeInstanceOf(HTMLAnchorElement);
    expect(projectsGroup.querySelectorAll('a[href="/staff/projects"]')).toHaveLength(1);
    expect(projectsGroup.textContent).toContain('Projects');
    expect(projectsGroup.textContent).toContain('Drafting Queue');
    expect(projectsGroup.compareDocumentPosition(contactsGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    rendered.unmount();
  });

  it('keeps parent label clicks as navigation without toggling sections', () => {
    mockPathname = '/staff/projects/design-packages';
    const rendered = renderSidebar();

    act(() => {
      linkByText(rendered.container, 'Projects').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
      );
    });

    expect(transitionMocks.routerReplace).toHaveBeenCalledWith('/staff/projects', { scroll: false });
    expect(transitionMocks.beginInstantRoute).toHaveBeenCalledWith('projects-index');
    expect(transitionMocks.beginRouteTransition).not.toHaveBeenCalled();
    expect(buttonByLabel(rendered.container, 'Collapse Projects').getAttribute('aria-expanded')).toBe('true');

    rendered.unmount();
  });

  it('keeps parent icon clicks as rail-source navigation in pinned mode', () => {
    mockPathname = '/staff/projects/design-packages';
    const rendered = renderSidebar();

    act(() => {
      linkByLabel(rendered.container, 'Projects').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
      );
    });

    expect(transitionMocks.routerReplace).toHaveBeenCalledWith('/staff/projects', { scroll: false });
    expect(transitionMocks.beginInstantRoute).toHaveBeenCalledWith('projects-index');
    expect(transitionMocks.beginRouteTransition).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('does not close from Escape because the panel is pinned-only', () => {
    mockPathname = '/staff/projects/design-packages';
    const rendered = renderSidebar();

    act(() => {
      panelLayer(rendered.container).parentElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });

    expect(panelLayer(rendered.container).getAttribute('aria-hidden')).toBe('false');
    expect(linkByText(rendered.container, 'Drafting Queue')).toBeInstanceOf(HTMLAnchorElement);

    rendered.unmount();
  });
});
