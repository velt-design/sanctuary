import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SidebarRevealOverlayLab from './SidebarRevealOverlayLab';
import { renderIntoDocument } from '../../../../test/reactHarness';

const transitionMocks = vi.hoisted(() => ({
  beginRouteTransition: vi.fn(),
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
}));

vi.mock('@/components/auth/PortalAuthProvider', () => ({
  usePortalSession: () => ({ role: mockRole }),
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

function renderSidebar() {
  return renderIntoDocument(
    <div>
      <aside data-portal-sidebar-rail="true">
        <a href="/dashboard" data-nav-key="dashboard" aria-label="Dashboard">
          Dashboard icon
        </a>
        <a href="/projects" data-nav-key="projects" aria-label="Projects">
          Projects icon
        </a>
      </aside>
      <SidebarRevealOverlayLab />
    </div>,
  );
}

function labelLayer(container: HTMLElement): HTMLElement {
  const overlay = container.querySelector('[aria-label="Sidebar reveal lab"]');
  const layer = overlay?.firstElementChild;
  if (!(layer instanceof HTMLElement)) throw new Error('Sidebar label layer not found.');
  return layer;
}

function linkByText(container: HTMLElement, text: string): HTMLAnchorElement {
  const link = Array.from(container.querySelectorAll('a')).find((node) => node.textContent?.trim() === text);
  if (!(link instanceof HTMLAnchorElement)) throw new Error(`Link not found: ${text}`);
  return link;
}

describe('SidebarRevealOverlayLab', () => {
  beforeEach(() => {
    transitionMocks.beginRouteTransition.mockReset();
    mockPathname = '/dashboard';
    mockSearchParams = new URLSearchParams();
    mockRole = 'staff';
    window.history.replaceState({}, '', '/dashboard');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    document.addEventListener('click', preventDocumentNavigation);
  });

  afterEach(() => {
    document.removeEventListener('click', preventDocumentNavigation);
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('closes the reveal nav immediately and starts an internal page transition', () => {
    const rendered = renderSidebar();
    const railLink = rendered.container.querySelector('a[data-nav-key="projects"]');

    act(() => {
      railLink?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(labelLayer(rendered.container).getAttribute('aria-hidden')).toBe('false');

    act(() => {
      linkByText(rendered.container, 'Projects').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
      );
    });

    expect(labelLayer(rendered.container).getAttribute('aria-hidden')).toBe('true');
    expect(transitionMocks.beginRouteTransition).toHaveBeenCalledWith({
      href: '/projects',
      label: 'Projects',
      source: 'sidebar-overlay',
    });

    rendered.unmount();
  });

  it('closes current-page clicks without starting a loading transition', () => {
    const rendered = renderSidebar();
    const railLink = rendered.container.querySelector('a[data-nav-key="dashboard"]');

    act(() => {
      railLink?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });

    act(() => {
      linkByText(rendered.container, 'Dashboard').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
      );
    });

    expect(labelLayer(rendered.container).getAttribute('aria-hidden')).toBe('true');
    expect(transitionMocks.beginRouteTransition).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('handles rail icon clicks with the same immediate close behavior', () => {
    const rendered = renderSidebar();
    const railDashboard = rendered.container.querySelector('a[data-nav-key="dashboard"]');
    const railProjects = rendered.container.querySelector('a[data-nav-key="projects"]');

    act(() => {
      railDashboard?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(labelLayer(rendered.container).getAttribute('aria-hidden')).toBe('false');

    act(() => {
      railProjects?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(labelLayer(rendered.container).getAttribute('aria-hidden')).toBe('true');
    expect(transitionMocks.beginRouteTransition).toHaveBeenCalledWith({
      href: '/projects',
      label: 'Projects',
      source: 'sidebar-rail',
    });

    rendered.unmount();
  });
});
