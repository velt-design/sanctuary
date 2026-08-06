import { describe, expect, it } from 'vitest';
import {
  PORTAL_INSTANT_ROUTE_DEFINITIONS,
  portalInstantRouteReleasesOnCommit,
  portalInstantRouteTarget,
} from './portalInstantRoutes';

describe('portal instant route registry', () => {
  it.each([
    ['/dashboard', 'dashboard'],
    ['/staff/projects', 'projects-index'],
    ['/staff/contacts?q=alex', 'contacts-index'],
    ['/schedule', 'schedule'],
    ['/staff/schedule?view=gantt', 'schedule'],
    ['/staff/projects/work-queue', 'work-queue'],
    ['/staff/projects/design-packages', 'design-list'],
    ['/staff/projects/running-jobs', 'running-jobs'],
    ['/staff/calculator', 'calculator'],
    ['/staff/projects/proj_123', 'project-detail'],
  ])('maps %s to %s', (href, expected) => {
    expect(portalInstantRouteTarget(href, 'https://portal.test/dashboard')?.route).toBe(expected);
  });

  it('does not claim unrelated, nested workflow, or external routes', () => {
    expect(portalInstantRouteTarget('/staff/projects/new', 'https://portal.test/dashboard')).toBeNull();
    expect(portalInstantRouteTarget('/staff/projects/proj_1/design-workbench', 'https://portal.test/dashboard')).toBeNull();
    expect(portalInstantRouteTarget('https://other.test/dashboard', 'https://portal.test/dashboard')).toBeNull();
  });

  it('requires every registered route to provide a truthful frame contract', () => {
    for (const definition of Object.values(PORTAL_INSTANT_ROUTE_DEFINITIONS)) {
      expect(definition.route).toBeTruthy();
      expect(definition.title).toBeTruthy();
      expect(definition.description).toBeTruthy();
      expect(definition.kind).toBeTruthy();
    }
    expect(portalInstantRouteReleasesOnCommit('schedule')).toBe(true);
    expect(portalInstantRouteReleasesOnCommit('projects-index')).toBe(false);
  });
});
