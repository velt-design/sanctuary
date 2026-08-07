import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import PortalExactRouteFrame from './PortalExactRouteFrame';
import type { PortalInstantRoute } from '@/lib/portalInstantRoutes';

let pathname = '/dashboard';
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
}));

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('PortalExactRouteFrame deep route identities', () => {
  beforeEach(() => {
    pathname = '/dashboard';
    searchParams = new URLSearchParams();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the legacy quote print route as the project-linked preview shell', () => {
    const rendered = renderIntoDocument(
      <PortalExactRouteFrame
        route="quote-detail"
        targetHref="/staff/projects/proj_1/quotes/quote_1/print"
      />,
    );

    expect(rendered.container.querySelector('[data-project-id="proj_1"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-quote-id="quote_1"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-page-shell="quote-preview"]')).not.toBeNull();
    rendered.unmount();
  });

  it('renders the nested estimate route with its requested workbook sheet', () => {
    const rendered = renderIntoDocument(
      <PortalExactRouteFrame
        route="estimate-detail"
        targetHref="/staff/projects/proj_1/estimate/estimate_1?sheet=overheads"
      />,
    );

    expect(rendered.container.querySelector('[data-project-id="proj_1"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-estimate-id="estimate_1"]')).not.toBeNull();
    expect(rendered.container.querySelector<HTMLSelectElement>('[aria-label="Job pack sheet"]')?.value)
      .toBe('overheads');
    rendered.unmount();
  });

  it('distinguishes standalone and project-linked booklet targets', () => {
    const rendered = renderIntoDocument(
      <PortalExactRouteFrame route="design-booklets" targetHref="/staff/design-booklets" />,
    );
    expect(rendered.container.querySelector('[data-design-booklet-mode="standalone"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Preview only · not saved');

    rendered.rerender(
      <PortalExactRouteFrame
        route="design-booklets"
        targetHref="/staff/design-booklets?projectId=proj_hello%20world"
      />,
    );
    const linked = rendered.container.querySelector('[data-design-booklet-mode="project"]');
    expect(linked?.getAttribute('data-project-id')).toBe('proj_hello world');
    expect(linked?.querySelector<HTMLAnchorElement>('a[href="/staff/projects/proj_hello%20world"]'))
      .not.toBeNull();
    rendered.unmount();
  });

  it('renders Projects filters from the target URL before the route commits', () => {
    const rendered = renderIntoDocument(
      <PortalExactRouteFrame
        route="projects-index"
        targetHref="/staff/projects?q=coastal%20home&journey=delivery&stage=scheduled&state=waiting&owner=ellen"
      />,
    );

    expect(rendered.container.querySelector<HTMLInputElement>('#projectSearch')?.value)
      .toBe('coastal home');
    expect(rendered.container.querySelector<HTMLSelectElement>('#projectJourneyFilter')?.value)
      .toBe('DELIVERY');
    expect(rendered.container.querySelector<HTMLSelectElement>('#projectStageFilter')?.value)
      .toBe('SCHEDULED');
    expect(rendered.container.querySelector<HTMLSelectElement>('#projectStateFilter')?.value)
      .toBe('WAITING');
    expect(rendered.container.querySelector<HTMLSelectElement>('#projectOwnerFilter')?.value)
      .toBe('ellen');
    rendered.unmount();
  });

  it('renders the Contacts search from the target URL before the route commits', () => {
    const rendered = renderIntoDocument(
      <PortalExactRouteFrame
        route="contacts-index"
        targetHref="/staff/contacts?q=Alex%20Morgan"
      />,
    );

    expect(rendered.container.querySelector<HTMLInputElement>('#contactSearchPending')?.value)
      .toBe('Alex Morgan');
    rendered.unmount();
  });

  it('fails closed when a route reaches the dispatcher without an exact frame', () => {
    expect(() => renderIntoDocument(
      <PortalExactRouteFrame route={'unregistered-route' as PortalInstantRoute} />,
    )).toThrow('Missing exact pending frame for registered portal route: unregistered-route');
  });
});
