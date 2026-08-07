import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { useProjectInstantOpen } from './ProjectInstantOpen';
import ProjectInstantNavigationProvider from './ProjectInstantNavigation';

const replace = vi.fn();
const routeTransition = vi.hoisted(() => ({
  beginRouteTransition: vi.fn(),
  pendingHref: null as string | null,
}));
const originalNavigatorOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine');

vi.mock('./[projectId]/ProjectSnapshotPageClient', () => ({
  default: ({ projectId, tab }: { projectId: string; tab: string }) => (
    <div data-testid="optimistic-project" data-project-id={projectId} data-tab={tab} />
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ replace }),
}));

vi.mock('@/components/page-state/PortalRouteTransition', () => ({
  usePortalRouteTransition: () => ({
    beginRouteTransition: routeTransition.beginRouteTransition,
    pendingHref: routeTransition.pendingHref,
  }),
}));

function InstantOpenHarness({ onOpened }: { onOpened?: () => void }) {
  const { openProject } = useProjectInstantOpen();
  return (
    <button
      type="button"
      onClick={() => {
        openProject('proj_1');
        onOpened?.();
      }}
    >
      Open project
    </button>
  );
}

function renderHarness() {
  return renderIntoDocument(
    <ProjectInstantNavigationProvider>
      <InstantOpenHarness />
    </ProjectInstantNavigationProvider>,
  );
}

describe('useProjectInstantOpen', () => {
  beforeEach(() => {
    replace.mockReset();
    routeTransition.beginRouteTransition.mockReset();
    routeTransition.pendingHref = null;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    window.history.replaceState(null, '', '/staff/projects');
  });

  afterEach(() => {
    if (originalNavigatorOnline) {
      Object.defineProperty(navigator, 'onLine', originalNavigatorOnline);
    } else {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  });

  it('updates history and shows the cached project client before the server route settles', () => {
    const rendered = renderHarness();

    act(() => {
      rendered.container.querySelector('button')?.click();
    });

    expect(window.location.pathname).toBe('/staff/projects/proj_1');
    expect(window.location.search).toBe('?tab=activity');
    expect(replace).toHaveBeenCalledWith('/staff/projects/proj_1', { scroll: false });
    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')?.getAttribute('data-project-id'))
      .toBe('proj_1');
    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')?.getAttribute('data-tab'))
      .toBe('activity');

    rendered.unmount();
  });

  it('clears the instant project when browser back returns to the projects list', () => {
    const rendered = renderHarness();
    act(() => rendered.container.querySelector('button')?.click());

    expect(rendered.container.textContent).not.toContain('Open project');

    window.history.replaceState(null, '', '/staff/projects');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));

    expect(rendered.container.textContent).toContain('Open project');
    rendered.unmount();
  });

  it('routes row and keyboard opens through the data-free shell while offline', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const rendered = renderHarness();

    act(() => {
      rendered.container.querySelector('button')?.click();
    });

    expect(routeTransition.beginRouteTransition).toHaveBeenCalledWith({
      href: '/staff/projects/proj_1',
      label: 'Project',
      source: 'projects-index-row',
    });
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/staff/projects');
    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')).toBeNull();
    rendered.unmount();
  });

  it('releases the instant project when the destination route children settle', () => {
    const rendered = renderHarness();
    act(() => rendered.container.querySelector('button')?.click());

    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')).not.toBeNull();

    rendered.rerender(
      <ProjectInstantNavigationProvider>
        <div data-testid="settled-project">Settled project route</div>
      </ProjectInstantNavigationProvider>,
    );

    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="settled-project"]')?.textContent)
      .toBe('Settled project route');
    rendered.unmount();
  });

  it('releases the instant project when navigation moves to a different project pathname', () => {
    const stableChildren = <InstantOpenHarness />;
    const rendered = renderIntoDocument(
      <ProjectInstantNavigationProvider>{stableChildren}</ProjectInstantNavigationProvider>,
    );
    act(() => rendered.container.querySelector('button')?.click());
    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')).not.toBeNull();

    window.history.pushState(null, '', '/staff/projects/proj_2');
    rendered.rerender(
      <ProjectInstantNavigationProvider>{stableChildren}</ProjectInstantNavigationProvider>,
    );

    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')).toBeNull();
    expect(rendered.container.textContent).toContain('Open project');
    rendered.unmount();
  });

  it('releases the instant project when the portal transition targets a different pathname', () => {
    const stableChildren = <InstantOpenHarness />;
    const rendered = renderIntoDocument(
      <ProjectInstantNavigationProvider>{stableChildren}</ProjectInstantNavigationProvider>,
    );
    act(() => rendered.container.querySelector('button')?.click());
    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')).not.toBeNull();

    routeTransition.pendingHref = '/staff/projects/proj_2';
    rendered.rerender(
      <ProjectInstantNavigationProvider>{stableChildren}</ProjectInstantNavigationProvider>,
    );

    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')).toBeNull();
    expect(rendered.container.textContent).toContain('Open project');
    rendered.unmount();
  });
});
