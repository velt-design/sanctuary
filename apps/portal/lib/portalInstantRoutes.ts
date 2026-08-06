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

type PortalInstantRouteKind =
  | 'dashboard'
  | 'index'
  | 'schedule'
  | 'queue'
  | 'spreadsheet'
  | 'calculator'
  | 'project-detail';

export type PortalInstantRouteDefinition = {
  route: PortalInstantRoute;
  title: string;
  description: string;
  kind: PortalInstantRouteKind;
  release: 'client-mounted' | 'route-commit';
};

export const PORTAL_INSTANT_ROUTE_DEFINITIONS = {
  dashboard: {
    route: 'dashboard',
    title: 'Dashboard',
    description: 'Updating pipeline, Project Work, estimates and activity.',
    kind: 'dashboard',
    release: 'route-commit',
  },
  'projects-index': {
    route: 'projects-index',
    title: 'Projects',
    description: 'Updating projects.',
    kind: 'index',
    release: 'client-mounted',
  },
  'contacts-index': {
    route: 'contacts-index',
    title: 'Contacts',
    description: 'Updating contacts.',
    kind: 'index',
    release: 'client-mounted',
  },
  schedule: {
    route: 'schedule',
    title: 'Schedule',
    description: 'Updating crews, planned work and unscheduled jobs.',
    kind: 'schedule',
    release: 'route-commit',
  },
  'work-queue': {
    route: 'work-queue',
    title: 'Work Queue',
    description: 'One current operational obligation per project.',
    kind: 'queue',
    release: 'route-commit',
  },
  'design-list': {
    route: 'design-list',
    title: 'Drafting Queue',
    description: 'Updating design requests and assignments.',
    kind: 'spreadsheet',
    release: 'route-commit',
  },
  'running-jobs': {
    route: 'running-jobs',
    title: 'Running Jobs',
    description: 'Updating active installation work.',
    kind: 'spreadsheet',
    release: 'route-commit',
  },
  calculator: {
    route: 'calculator',
    title: 'Calculator',
    description: 'Preparing the calculator workspace.',
    kind: 'calculator',
    release: 'route-commit',
  },
  'project-detail': {
    route: 'project-detail',
    title: 'Opening project...',
    description: 'Preparing the project summary while current data refreshes.',
    kind: 'project-detail',
    release: 'route-commit',
  },
} as const satisfies Record<PortalInstantRoute, PortalInstantRouteDefinition>;

export type PortalInstantRouteTarget = {
  route: PortalInstantRoute;
  url: URL;
  definition: PortalInstantRouteDefinition;
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

export function portalInstantRouteTarget(
  href: string,
  base?: string | URL,
): PortalInstantRouteTarget | null {
  try {
    const current = base ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    const currentUrl = new URL(current);
    const url = new URL(href, currentUrl);
    if (url.origin !== currentUrl.origin) return null;
    const route = routeForPathname(url.pathname);
    if (!route) return null;
    return { route, url, definition: PORTAL_INSTANT_ROUTE_DEFINITIONS[route] };
  } catch {
    return null;
  }
}

export function portalInstantRouteReleasesOnCommit(route: PortalInstantRoute): boolean {
  return PORTAL_INSTANT_ROUTE_DEFINITIONS[route].release === 'route-commit';
}
