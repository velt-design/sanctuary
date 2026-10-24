import { describe, expect, it, vi } from 'vitest';
import {
  portalInstantRouteReleasesOnCommit,
  portalInstantRouteTarget,
  resolvePortalSameOriginUrl,
} from './portalInstantRoutes';

describe('portal instant route selection', () => {
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

  it.each([
    ['dashboard', true], ['projects-index', false], ['contacts-index', false], ['schedule', true],
    ['work-queue', true], ['design-list', true], ['running-jobs', true], ['calculator', true], ['project-detail', true],
  ] as const)('retains the exact release policy for %s', (route, commits) => {
    expect(portalInstantRouteReleasesOnCommit(route)).toBe(commits);
  });

  it.each([
    ['/', 'dashboard'], ['/staff/running-jobs', 'running-jobs'], ['/schedule', 'schedule'],
  ])('retains the existing broader alias %s without changing its URL', (path, route) => {
    const href = path + '?from=projects#details';
    const target = portalInstantRouteTarget(href, 'https://portal.test/dashboard');
    expect(target?.route).toBe(route);
    expect(target?.url.href).toBe('https://portal.test' + href);
    expect(Object.keys(target ?? {}).sort()).toEqual(['route', 'url']);
  });
});


describe('same-origin URL resolution without route policy', () => {
  it('retains relative path, encoded identity, query and hash with a URL base', () => {
    const url = resolvePortalSameOriginUrl('./%20proj_A?tab=files#notes', new URL('https://portal.test/staff/projects/'));
    expect(url?.href).toBe('https://portal.test/staff/projects/%20proj_A?tab=files#notes');
    // Resolution is policy-free: an API URL is not a route selection.
    expect(resolvePortalSameOriginUrl('/api/staff/v1/search?q=Beta', 'https://portal.test/dashboard')?.pathname).toBe('/api/staff/v1/search');
    expect(portalInstantRouteTarget('/api/staff/v1/search?q=Beta', 'https://portal.test/dashboard')).toBeNull();
  });

  it.each([
    ['//foreign.test/dashboard', 'https://portal.test/dashboard'],
    ['http://portal.test/dashboard', 'https://portal.test/dashboard'],
    ['/dashboard', 'http://['],
    ['http://[', 'https://portal.test/dashboard'],
  ])('rejects malformed or different-origin URL %s with base %s', (href, base) => {
    expect(resolvePortalSameOriginUrl(href, base)).toBeNull();
  });

  it('preserves the existing target API browser and server defaults independently of the resolver', () => {
    expect(portalInstantRouteTarget('/dashboard')?.url.origin).toBe(window.location.origin);
    expect(portalInstantRouteTarget('/schedule', new URL('https://portal.test/dashboard'))?.route).toBe('schedule');
    vi.stubGlobal('window', undefined);
    try {
      expect(portalInstantRouteTarget('/dashboard')?.url.href).toBe('http://localhost/dashboard');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
