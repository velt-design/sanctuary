import { describe, expect, it } from 'vitest';
import {
  PORTAL_INSTANT_ROUTE_DEFINITIONS,
  portalInstantRouteReleasesOnCommit,
  portalInstantRouteTarget,
} from './portalInstantRoutes';
import { NAV_ITEMS } from '@/components/navigation/navItems';

describe('portal instant route registry', () => {
  it.each([
    ['/dashboard', 'dashboard'],
    ['/staff', 'dashboard'],
    ['/staff/projects', 'projects-index'],
    ['/projects', 'projects-index'],
    ['/staff/contacts?q=alex', 'contacts-index'],
    ['/contacts?q=alex', 'contacts-index'],
    ['/schedule', 'schedule'],
    ['/staff/schedule?view=gantt', 'schedule'],
    ['/staff/projects/work-queue', 'work-queue'],
    ['/staff/projects/design-packages', 'design-list'],
    ['/staff/projects/running-jobs', 'running-jobs'],
    ['/staff/calculator', 'calculator'],
    ['/calculator', 'calculator'],
    ['/staff/old-calculator', 'calculator'],
    ['/staff/projects/proj_123', 'project-detail'],
    ['/projects/proj_123', 'project-detail'],
    ['/staff/projects/proj_123/design-workbench', 'design-workbench'],
    ['/projects/proj_123/design-workbench', 'design-workbench'],
    ['/staff/projects/new', 'project-create'],
    ['/staff/contacts/new', 'contact-create'],
    ['/staff/contacts/ct_123', 'contact-detail'],
    ['/contacts/ct_123', 'contact-detail'],
    ['/staff/projects/proj_123/estimate/est_1', 'estimate-detail'],
    ['/staff/projects/proj_123/quotes/quote_1', 'quote-detail'],
    ['/staff/projects/proj_123/quotes/quote_1/print', 'quote-detail'],
    ['/staff/ui-foundation', 'ui-foundation'],
    ['/staff/email-previews', 'email-previews'],
    ['/staff/design-booklets', 'design-booklets'],
    ['/admin/access', 'admin-access'],
    ['/imports', 'admin-imports'],
    ['/admin/imports', 'admin-imports'],
    ['/admin/costing', 'admin-costing'],
    ['/admin/costs/materials', 'admin-costing'],
    ['/pricebook', 'admin-costing'],
    ['/staff/pricebook', 'admin-costing'],
  ])('maps %s to %s', (href, expected) => {
    expect(portalInstantRouteTarget(href, 'https://portal.test/dashboard')?.route).toBe(expected);
  });

  it('does not claim unrelated nested workflows or external routes', () => {
    expect(portalInstantRouteTarget('/staff/projects/proj_1/design-workbench/export', 'https://portal.test/dashboard')).toBeNull();
    expect(portalInstantRouteTarget('https://other.test/dashboard', 'https://portal.test/dashboard')).toBeNull();
  });

  it('requires complete metadata for every registered route', () => {
    for (const definition of Object.values(PORTAL_INSTANT_ROUTE_DEFINITIONS)) {
      expect(definition.route).toBeTruthy();
      expect(definition.title).toBeTruthy();
      expect(definition.description).toBeTruthy();
      expect(definition.kind).toBeTruthy();
    }
    expect(portalInstantRouteReleasesOnCommit('schedule')).toBe(true);
    expect(portalInstantRouteReleasesOnCommit('design-workbench')).toBe(true);
    expect(portalInstantRouteReleasesOnCommit('projects-index')).toBe(false);
  });

  it('covers every current sidebar destination with an instant frame', () => {
    const hrefs = NAV_ITEMS.flatMap((item) => [
      item.href,
      ...('children' in item ? item.children.map((child) => child.href) : []),
    ]);

    for (const href of hrefs) {
      expect(portalInstantRouteTarget(href, 'https://portal.test/dashboard'), href).not.toBeNull();
    }
  });
});
