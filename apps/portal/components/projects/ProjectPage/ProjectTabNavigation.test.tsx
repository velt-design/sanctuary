import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectTabNavigation from './ProjectTabNavigation';

const preloadMock = vi.fn();
const routeTransitionMocks = vi.hoisted(() => ({ navigateRoute: vi.fn() }));
let mockSearchParams = 'tab=activity';

vi.mock('next/navigation', () => ({
  usePathname: () => '/staff/projects/proj_1',
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}));

vi.mock('@/components/page-state/PortalRouteTransition', () => ({
  usePortalRouteTransition: () => ({ navigateRoute: routeTransitionMocks.navigateRoute }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

vi.mock('./projectTabModules', () => ({
  preloadProjectTab: (...args: unknown[]) => preloadMock(...args),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

describe('ProjectTabNavigation', () => {
  beforeEach(() => {
    mockSearchParams = 'tab=activity';
    routeTransitionMocks.navigateRoute.mockReset();
    preloadMock.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the four navigation owners with conditional Job Packs', () => {
    const rendered = renderIntoDocument(
      <ProjectTabNavigation hasJobPacks host="host" initialTab="activity" projectId="proj_1" />,
    );
    const labels = Array.from(rendered.container.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent?.trim());

    expect(labels).toEqual(['Overview', 'Calculator', 'Commercial', 'Job Packs']);
    expect(rendered.container.querySelector('[aria-selected="true"]')?.textContent).toContain('Overview');
    rendered.unmount();
  });

  it('hides Job Packs when unavailable', () => {
    const rendered = renderIntoDocument(
      <ProjectTabNavigation hasJobPacks={false} host="host" initialTab="activity" projectId="proj_1" />,
    );
    expect(rendered.container.textContent).not.toContain('Job Packs');
    rendered.unmount();
  });

  it('normalizes invalid tabs to Overview and preserves unrelated query parameters', () => {
    mockSearchParams = 'tab=details&campaign=winter';
    const rendered = renderIntoDocument(
      <ProjectTabNavigation hasJobPacks host="host" initialTab="details" projectId="proj_1" />,
    );

    expect(routeTransitionMocks.navigateRoute).toHaveBeenCalledWith(
      {
        href: '/staff/projects/proj_1?tab=activity&campaign=winter',
        label: 'Overview',
        source: 'project-tab',
      },
      { replace: true, scroll: false },
    );
    rendered.unmount();
  });

  it('navigates and preloads from pointer or keyboard focus intent', () => {
    const onTabSelect = vi.fn();
    const rendered = renderIntoDocument(
      <ProjectTabNavigation
        hasJobPacks
        host="host"
        initialTab="activity"
        projectId="proj_1"
        onTabSelect={onTabSelect}
      />,
    );
    const commercial = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((tab) => tab.textContent?.trim() === 'Commercial');

    act(() => {
      commercial?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      commercial?.click();
    });

    expect(preloadMock).toHaveBeenCalledWith('quotes', expect.objectContaining({ host: 'host', projectId: 'proj_1' }));
    expect(routeTransitionMocks.navigateRoute).toHaveBeenCalledWith(
      {
        href: '/staff/projects/proj_1?tab=quotes',
        label: 'Commercial',
        source: 'project-tab',
      },
      { replace: true, scroll: false },
    );
    expect(onTabSelect).toHaveBeenCalledWith('quotes');
    rendered.unmount();
  });

  it('marks Commercial selected for the invoices compatibility route', () => {
    mockSearchParams = 'tab=invoices';
    const rendered = renderIntoDocument(
      <ProjectTabNavigation hasJobPacks host="host" initialTab="invoices" projectId="proj_1" />,
    );

    expect(rendered.container.querySelector('[aria-selected="true"]')?.textContent).toContain('Commercial');
    rendered.unmount();
  });

  it('normalizes the retired Emails route to Overview', () => {
    mockSearchParams = 'tab=emails&campaign=winter';
    const rendered = renderIntoDocument(
      <ProjectTabNavigation hasJobPacks host="host" initialTab="emails" projectId="proj_1" />,
    );

    expect(routeTransitionMocks.navigateRoute).toHaveBeenCalledWith(
      {
        href: '/staff/projects/proj_1?tab=activity&campaign=winter',
        label: 'Overview',
        source: 'project-tab',
      },
      { replace: true, scroll: false },
    );
    rendered.unmount();
  });
});
