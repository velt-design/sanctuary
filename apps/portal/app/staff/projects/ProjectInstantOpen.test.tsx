import { act, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { useProjectInstantOpen } from './ProjectInstantOpen';
import ProjectInstantNavigationProvider from './ProjectInstantNavigation';
import { PortalInstantRouteContent, PortalRouteTransitionProvider, usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { PortalGuardedPage, usePortalPageSource } from '@/components/page-state/PortalPageSource';

const replace = vi.fn();
const routeTransition = vi.hoisted(() => ({ pendingHref: null as string | null }));
const navigation = vi.hoisted(() => ({ canonical: '/staff/projects', pathname: null as string | null }));
const lifetime = vi.hoisted(() => ({ mounted: 0, retired: 0 }));
const outlet = vi.hoisted(() => ({ mounted: 0, retired: 0 }));

vi.mock('./[projectId]/ProjectSnapshotSurface', () => ({
  default: ({ projectId, tab }: { projectId: string; tab: string }) => {
    useEffect(() => { lifetime.mounted++; return () => { lifetime.mounted--; lifetime.retired++; }; }, []);
    return <div data-testid="optimistic-project" data-project-id={projectId} data-tab={tab}>
      <input aria-label="Detail local view" defaultValue="Original view" />
      <InstantOpenHarness projectId="proj_2" label="Open next project" />
    </div>;
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname ?? window.location.pathname,
  useSelectedLayoutSegments: () => navigation.canonical.split('/').filter(Boolean),
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ replace, prefetch: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/components/page-state/PortalRouteTransition', async original => {
  const actual = await original<typeof import('@/components/page-state/PortalRouteTransition')>();
  return { ...actual, usePortalRouteTransition: () => {
    const value = actual.usePortalRouteTransition();
    return { ...value, pendingHref: routeTransition.pendingHref ?? value.pendingHref };
  } };
});

function InstantOpenHarness({ onOpened, projectId = 'proj_1', label = 'Open project' }: { onOpened?: () => void; projectId?: string; label?: string }) {
  const { openProject } = useProjectInstantOpen();
  return (
    <button
      type="button"
      onClick={() => {
        openProject(projectId);
        onOpened?.();
      }}
    >
      {label}
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
    routeTransition.pendingHref = null;
    navigation.canonical = '/staff/projects'; navigation.pathname = null;
    lifetime.mounted = 0; lifetime.retired = 0;
    window.history.replaceState(null, '', '/staff/projects');
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

    expect(rendered.container.textContent).toContain('Open project'); // The real outlet stays mounted.

    window.history.replaceState(null, '', '/staff/projects');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));

    expect(rendered.container.textContent).toContain('Open project');
    rendered.unmount();
  });

  it('keeps the same actual frame while the real destination outlet settles', () => {
    const rendered = renderHarness();
    act(() => rendered.container.querySelector('button')?.click());

    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')).not.toBeNull();

    const frame = rendered.container.querySelector('[data-testid="optimistic-project"]');
    rendered.rerender(
      <ProjectInstantNavigationProvider>
        <div data-testid="settled-project">Settled project route</div>
      </ProjectInstantNavigationProvider>,
    );

    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')).toBe(frame);
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

    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')?.getAttribute('data-project-id')).toBe('proj_2');
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

    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')?.getAttribute('data-project-id')).toBe('proj_2');
    expect(rendered.container.textContent).toContain('Open project');
    rendered.unmount();
  });

  it('preserves a no-source opening on the old pathname and still retires on pendingHref before pathname adoption', () => {
    navigation.pathname = '/staff/projects';
    const stableChildren = <InstantOpenHarness />;
    const ui = <ProjectInstantNavigationProvider>{stableChildren}</ProjectInstantNavigationProvider>;
    const rendered = renderIntoDocument(ui);
    act(() => rendered.container.querySelector('button')?.click());
    const instant = rendered.container.querySelector('[data-testid="optimistic-project"]');
    expect(instant).not.toBeNull();
    rendered.rerender(ui);
    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')).toBe(instant);
    routeTransition.pendingHref = '/staff/projects/proj_2';
    rendered.rerender(<ProjectInstantNavigationProvider>{stableChildren}</ProjectInstantNavigationProvider>);
    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')?.getAttribute('data-project-id')).toBe('proj_2');
    expect(rendered.container.textContent).toContain('Open project');
    rendered.unmount();
  });
});

describe('accepted Projects source retirement with a retained Next outlet', () => {
  let view: ReturnType<typeof renderIntoDocument>;
  let client: QueryClient;
  const indexCompletion = {}, detailCompletion = {}, nextDetailCompletion = {}, recoveryCompletion = {};
  let denied = false, recovered = false;

  function AcceptedProjects() {
    const { beginInstantRoute, pendingHref } = usePortalRouteTransition();
    const source = usePortalPageSource();
    return <><button data-return onClick={() => {
      beginInstantRoute('projects-index', { href: '/staff/projects' });
      window.history.pushState(null, '', '/staff/projects');
    }}>Return to Projects</button><output data-selection={source?.selectedPath}
      data-canonical={source?.canonicalPath} data-pending={pendingHref ?? ''}
      data-owner={source?.owner === (recovered ? recoveryCompletion : indexCompletion) ? 'index' : source?.owner ? 'detail' : 'pending'} /></>;
  }
  function StableOutlet() {
    useEffect(() => { outlet.mounted++; return () => { outlet.mounted--; outlet.retired++; }; }, []);
    const source = usePortalPageSource();
    const path = source?.canonicalPath ?? '/staff/projects';
    return path === '/staff/projects'
      ? <PortalGuardedPage pathname={path} completion={recovered ? recoveryCompletion : indexCompletion} unavailable={denied}>
          <p data-index-evidence>Current permitted Projects facts</p><InstantOpenHarness />
        </PortalGuardedPage>
      : <PortalGuardedPage pathname={path} completion={path.endsWith('proj_2') ? nextDetailCompletion : detailCompletion} publicFrame={false}>
          <p data-canonical-detail>Current canonical detail</p>
        </PortalGuardedPage>;
  }
  // The same element models Next retaining its layout outlet across adoption.
  const stableChildren = <StableOutlet />;
  function tree() {
    return <QueryClientProvider client={client}><PortalRouteTransitionProvider>
      <AcceptedProjects /><PortalInstantRouteContent>
        <ProjectInstantNavigationProvider>{stableChildren}</ProjectInstantNavigationProvider>
      </PortalInstantRouteContent>
    </PortalRouteTransitionProvider></QueryClientProvider>;
  }
  function adopt(path: string) {
    navigation.canonical = path; navigation.pathname = null;
    view.rerender(tree());
  }
  function open() { act(() => view.container.querySelector<HTMLButtonElement>('[data-index-evidence] + button')!.click()); }
  function returnToProjects() { act(() => view.container.querySelector<HTMLButtonElement>('[data-return]')!.click()); }
  beforeEach(() => {
    window.history.replaceState(null, '', '/staff/projects'); navigation.canonical = '/staff/projects'; navigation.pathname = null;
    denied = false; recovered = false; routeTransition.pendingHref = null; lifetime.mounted = 0; lifetime.retired = 0; outlet.mounted = 0; outlet.retired = 0;
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    view = renderIntoDocument(tree());
  });
  afterEach(() => { view.unmount(); client.clear(); });

  it('retires the real instant provider after settled detail on accepted index selection without pendingHref or changed children', () => {
    open();
    expect(outlet.mounted).toBe(1); expect(outlet.retired).toBe(0);
    const detail = view.container.querySelector('[data-testid="optimistic-project"]');
    adopt('/staff/projects/proj_1');
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBe(detail);
    expect(lifetime.mounted).toBe(1);
    navigation.pathname = '/staff/projects/proj_1';
    returnToProjects();
    expect(window.location.pathname).toBe('/staff/projects');
    expect(view.container.querySelector('h1')?.textContent).toBe('Projects');
    expect(view.container.querySelector('[data-pending]')?.getAttribute('data-pending')).toBe('');
    expect(view.container.querySelector('[data-selection]')?.getAttribute('data-selection')).toBe('/staff/projects');
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBeNull();
    expect(lifetime.mounted).toBe(0); expect(lifetime.retired).toBe(1);
    recovered = true; adopt('/staff/projects');
    expect(view.container.querySelector('[data-index-evidence]')).not.toBeNull();
    expect(view.container.querySelector('[data-owner]')?.getAttribute('data-owner')).toBe('index');
    expect(view.container.querySelector('[data-canonical-detail]')).toBeNull();
    expect(outlet.mounted).toBe(1); expect(outlet.retired).toBe(0);
  });

  it('keeps the same instant node and local focus through same-detail adoption and same-path search', () => {
    navigation.pathname = '/staff/projects';
    open();
    const detail = view.container.querySelector('[data-testid="optimistic-project"]');
    const input = view.container.querySelector<HTMLInputElement>('[aria-label="Detail local view"]')!;
    input.value = 'Current local view'; input.focus();
    // The old Projects source is still present while the detail request is held.
    navigation.pathname = '/staff/projects'; view.rerender(tree());
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBe(detail);
    expect(lifetime.mounted).toBe(1); expect(lifetime.retired).toBe(0);
    adopt('/staff/projects/proj_1');
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBe(detail);
    expect(document.activeElement).toBe(input); expect(input.value).toBe('Current local view');
    window.history.replaceState(null, '', '/staff/projects/proj_1?tab=quotes'); view.rerender(tree());
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBe(detail);
    expect(document.activeElement).toBe(input); expect(lifetime.retired).toBe(0);
  });

  it('retires a pre-adoption instant detail on a new accepted index attempt while the original Projects source is retained', () => {
    open();
    navigation.pathname = '/staff/projects';
    returnToProjects();
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBeNull();
    expect(lifetime.mounted).toBe(0); expect(lifetime.retired).toBe(1);
    expect(view.container.querySelector('h1')?.textContent).toBe('Projects');
    recovered = true; adopt('/staff/projects');
    expect(view.container.querySelector('[data-index-evidence]')).not.toBeNull();
  });

  it('does not revive the retired instant owner through index denial and a new genuine recovery completion', () => {
    open(); adopt('/staff/projects/proj_1'); navigation.pathname = '/staff/projects/proj_1';
    returnToProjects();
    denied = true; adopt('/staff/projects');
    expect(view.container.textContent).toContain('Projects unavailable');
    expect(view.container.querySelector('[data-index-evidence]')).toBeNull();
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBeNull();
    expect(lifetime.mounted).toBe(0);
    denied = false; recovered = true; adopt('/staff/projects');
    expect(view.container.querySelector('[data-index-evidence]')).not.toBeNull();
    expect(view.container.querySelector('[data-owner]')?.getAttribute('data-owner')).toBe('index');
    expect(lifetime.mounted).toBe(0); expect(lifetime.retired).toBe(1);
  });

  it('reuses cached index completion on native Back and cached detail on Forward without reviving its retired instant owner', () => {
    open(); adopt('/staff/projects/proj_1');
    act(() => { window.history.replaceState(null, '', '/staff/projects'); window.dispatchEvent(new PopStateEvent('popstate')); });
    adopt('/staff/projects');
    expect(view.container.querySelector('[data-index-evidence]')).not.toBeNull();
    expect(view.container.querySelector('[data-owner]')?.getAttribute('data-owner')).toBe('index');
    expect(lifetime.mounted).toBe(0); expect(lifetime.retired).toBe(1);
    act(() => { window.history.replaceState(null, '', '/staff/projects/proj_1'); window.dispatchEvent(new PopStateEvent('popstate')); });
    adopt('/staff/projects/proj_1');
    expect(view.container.querySelector('[data-canonical-detail]')).not.toBeNull();
    expect(view.container.querySelector('[data-index-evidence]')).toBeNull();
    expect(view.container.querySelector('[data-testid="optimistic-project"]')?.getAttribute('data-project-id')).toBe('proj_1');
    expect(lifetime.mounted).toBe(1);
    expect(outlet.mounted).toBe(1); expect(outlet.retired).toBe(0);
  });

  it('keeps the replacement project B through its adoption and retires B on the next accepted index selection', () => {
    open(); adopt('/staff/projects/proj_1');
    navigation.pathname = '/staff/projects/proj_1';
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="optimistic-project"] button')!.click());
    const second = view.container.querySelector('[data-testid="optimistic-project"]');
    expect(second?.getAttribute('data-project-id')).toBe('proj_2');
    navigation.pathname = '/staff/projects/proj_1'; view.rerender(tree());
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBe(second);
    adopt('/staff/projects/proj_2');
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBe(second);
    navigation.pathname = '/staff/projects/proj_2'; returnToProjects();
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBeNull();
    recovered = true; adopt('/staff/projects');
    expect(view.container.querySelector('[data-index-evidence]')).not.toBeNull();
  });

  it('reuses the retained cached Projects completion on an ordinary settled detail link-return', () => {
    open(); adopt('/staff/projects/proj_1'); navigation.pathname = '/staff/projects/proj_1';
    returnToProjects(); adopt('/staff/projects');
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBeNull();
    expect(view.container.querySelector('[data-index-evidence]')).not.toBeNull();
    expect(view.container.querySelector('[data-owner]')?.getAttribute('data-owner')).toBe('index');
  });

  it('rejects the denied cached index on native Back and Forward, then recovers only a distinct genuine completion', () => {
    open(); adopt('/staff/projects/proj_1'); navigation.pathname = '/staff/projects/proj_1';
    returnToProjects(); denied = true; adopt('/staff/projects');
    expect(view.container.textContent).toContain('Projects unavailable');
    expect(view.container.querySelector('[data-index-evidence]')).toBeNull();
    denied = false;
    act(() => { window.history.replaceState(null, '', '/staff/projects/proj_1'); window.dispatchEvent(new PopStateEvent('popstate')); });
    adopt('/staff/projects/proj_1');
    expect(view.container.querySelector('[data-canonical-detail]')).not.toBeNull();
    act(() => { window.history.replaceState(null, '', '/staff/projects'); window.dispatchEvent(new PopStateEvent('popstate')); });
    adopt('/staff/projects');
    expect(view.container.querySelector('[data-index-evidence]')).toBeNull();
    expect(view.container.querySelector('[data-owner]')?.getAttribute('data-owner')).toBe('pending');
    expect(lifetime.mounted).toBe(0);
    recovered = true; adopt('/staff/projects');
    expect(view.container.querySelector('[data-index-evidence]')).not.toBeNull();
    expect(view.container.querySelector('[data-owner]')?.getAttribute('data-owner')).toBe('index');
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBeNull();
    recovered = false; adopt('/staff/projects');
    expect(view.container.querySelector('[data-index-evidence]')).toBeNull();
    expect(view.container.querySelector('[data-testid="optimistic-project"]')).toBeNull();
  });
});
