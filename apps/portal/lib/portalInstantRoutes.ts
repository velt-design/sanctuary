export type PortalInstantRoute =
  | 'dashboard'
  | 'projects-index'
  | 'contacts-index'
  | 'schedule'
  | 'work-queue'
  | 'design-list'
  | 'running-jobs'
  | 'calculator'
  | 'project-detail';

export type PortalInstantRouteTarget = {
  route: PortalInstantRoute;
  url: URL;
};

function routeForPathname(pathname: string): PortalInstantRoute | null {
  if (pathname === '/' || pathname === '/dashboard') return 'dashboard';
  if (pathname === '/staff/projects') return 'projects-index';
  if (pathname === '/staff/contacts') return 'contacts-index';
  if (pathname === '/schedule' || pathname === '/staff/schedule') return 'schedule';
  if (pathname === '/staff/projects/work-queue') return 'work-queue';
  if (pathname === '/staff/projects/design-packages') return 'design-list';
  if (pathname === '/staff/projects/running-jobs' || pathname === '/staff/running-jobs') return 'running-jobs';
  if (pathname === '/staff/calculator') return 'calculator';
  if (pathname === '/staff/projects/new') return null;
  if (/^\/staff\/projects\/[^/]+$/.test(pathname)) return 'project-detail';
  return null;
}

/** Resolve a public URL without selecting a route or granting access. */
export function resolvePortalSameOriginUrl(href: string, base: string | URL): URL | null {
  try {
    const currentUrl = new URL(base);
    const url = new URL(href, currentUrl);
    return url.origin === currentUrl.origin ? url : null;
  } catch {
    return null;
  }
}

export function portalInstantRouteTarget(
  href: string,
  base?: string | URL,
): PortalInstantRouteTarget | null {
  try {
    const current = base ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    const url = resolvePortalSameOriginUrl(href, current);
    if (!url) return null;
    const route = routeForPathname(url.pathname);
    if (!route) return null;
    return { route, url };
  } catch {
    return null;
  }
}

export function portalInstantRouteReleasesOnCommit(route: PortalInstantRoute): boolean {
  return route !== 'projects-index' && route !== 'contacts-index';
}
