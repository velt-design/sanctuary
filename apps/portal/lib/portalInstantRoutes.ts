export type PortalInstantRoute =
  | 'dashboard'
  | 'projects-index'
  | 'contacts-index'
  | 'schedule'
  | 'work-queue'
  | 'design-list'
  | 'running-jobs'
  | 'calculator'
  | 'project-detail'
  | 'design-workbench'
  | 'project-create'
  | 'contact-detail'
  | 'contact-create'
  | 'quote-detail'
  | 'estimate-detail'
  | 'ui-foundation'
  | 'email-previews'
  | 'design-booklets'
  | 'admin-access'
  | 'admin-imports'
  | 'admin-costing';

type PortalInstantRouteKind =
  | 'dashboard'
  | 'index'
  | 'schedule'
  | 'queue'
  | 'spreadsheet'
  | 'calculator'
  | 'project-detail'
  | 'form'
  | 'commercial'
  | 'admin'
  | 'specialist';

type PortalInstantRouteDefinition = {
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
  'design-workbench': {
    route: 'design-workbench',
    title: 'Design Workbench',
    description: 'Preparing the project drawing workspace.',
    kind: 'specialist',
    release: 'route-commit',
  },
  'project-create': {
    route: 'project-create',
    title: 'New Project',
    description: 'Preparing the project and primary contact form.',
    kind: 'form',
    release: 'route-commit',
  },
  'contact-detail': {
    route: 'contact-detail',
    title: 'Contact',
    description: 'Preparing customer details and linked projects.',
    kind: 'project-detail',
    release: 'route-commit',
  },
  'contact-create': {
    route: 'contact-create',
    title: 'New Contact',
    description: 'Preparing the contact form.',
    kind: 'form',
    release: 'route-commit',
  },
  'quote-detail': {
    route: 'quote-detail',
    title: 'Quote',
    description: 'Preparing the quote workspace.',
    kind: 'commercial',
    release: 'route-commit',
  },
  'estimate-detail': {
    route: 'estimate-detail',
    title: 'Estimate',
    description: 'Preparing the project calculator.',
    kind: 'commercial',
    release: 'route-commit',
  },
  'ui-foundation': {
    route: 'ui-foundation',
    title: 'UI Foundation',
    description: 'Preparing the portal component catalogue.',
    kind: 'specialist',
    release: 'route-commit',
  },
  'email-previews': {
    route: 'email-previews',
    title: 'Email Preview Workbench',
    description: 'Preparing the email preview workspace.',
    kind: 'specialist',
    release: 'route-commit',
  },
  'design-booklets': {
    route: 'design-booklets',
    title: 'Design Booklets',
    description: 'Preparing the design booklet workspace.',
    kind: 'specialist',
    release: 'route-commit',
  },
  'admin-access': {
    route: 'admin-access',
    title: 'Access',
    description: 'Preparing portal access controls.',
    kind: 'admin',
    release: 'route-commit',
  },
  'admin-imports': {
    route: 'admin-imports',
    title: 'Imports',
    description: 'Preparing the import workspace.',
    kind: 'admin',
    release: 'route-commit',
  },
  'admin-costing': {
    route: 'admin-costing',
    title: 'Costing Control',
    description: 'Preparing costing controls.',
    kind: 'admin',
    release: 'route-commit',
  },
} as const satisfies Record<PortalInstantRoute, PortalInstantRouteDefinition>;

export type PortalInstantRouteTarget = {
  route: PortalInstantRoute;
  url: URL;
  definition: PortalInstantRouteDefinition;
};

function normalizePortalInstantPathname(pathname: string): string {
  if (pathname === '/projects' || pathname.startsWith('/projects/')) {
    return `/staff${pathname}`;
  }
  if (pathname === '/contacts' || pathname.startsWith('/contacts/')) {
    return `/staff${pathname}`;
  }
  if (
    pathname === '/calculator'
    || pathname === '/old-calculator'
    || pathname === '/running-jobs'
    || pathname === '/ui-foundation'
    || pathname === '/email-previews'
    || pathname === '/design-booklets'
  ) {
    return `/staff${pathname}`;
  }
  return pathname;
}

export function portalInstantRouteForPathname(pathname: string): PortalInstantRoute | null {
  pathname = normalizePortalInstantPathname(pathname);
  if (pathname === '/' || pathname === '/dashboard') return 'dashboard';
  if (pathname === '/staff') return 'dashboard';
  if (pathname === '/staff/projects') return 'projects-index';
  if (pathname === '/staff/contacts') return 'contacts-index';
  if (pathname === '/schedule' || pathname === '/staff/schedule') return 'schedule';
  if (pathname === '/staff/projects/work-queue') return 'work-queue';
  if (pathname === '/staff/projects/design-packages') return 'design-list';
  if (pathname === '/staff/projects/running-jobs' || pathname === '/staff/running-jobs') return 'running-jobs';
  if (pathname === '/staff/calculator' || pathname === '/staff/old-calculator') return 'calculator';
  if (pathname === '/staff/projects/new') return 'project-create';
  if (pathname === '/staff/contacts/new') return 'contact-create';
  if (/^\/staff\/contacts\/[^/]+$/.test(pathname)) return 'contact-detail';
  if (/^\/staff\/projects\/[^/]+\/estimate\/[^/]+$/.test(pathname)) return 'estimate-detail';
  if (/^\/staff\/projects\/[^/]+\/quotes\/[^/]+(?:\/print)?$/.test(pathname)) return 'quote-detail';
  if (/^\/staff\/projects\/[^/]+\/design-workbench\/?$/.test(pathname)) return 'design-workbench';
  if (/^\/staff\/projects\/[^/]+$/.test(pathname)) return 'project-detail';
  if (pathname === '/staff/ui-foundation') return 'ui-foundation';
  if (pathname === '/staff/email-previews') return 'email-previews';
  if (pathname === '/staff/design-booklets') return 'design-booklets';
  if (pathname === '/admin/access') return 'admin-access';
  if (pathname === '/imports' || pathname === '/admin/imports') return 'admin-imports';
  if (
    pathname === '/admin'
    || pathname === '/admin/costing'
    || pathname === '/pricebook'
    || pathname === '/staff/pricebook'
    || /^\/admin\/costs\/(?:materials|actions|overheads)$/.test(pathname)
  ) return 'admin-costing';
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
    const route = portalInstantRouteForPathname(url.pathname);
    if (!route) return null;
    return { route, url, definition: PORTAL_INSTANT_ROUTE_DEFINITIONS[route] };
  } catch {
    return null;
  }
}

export function portalInstantRouteReleasesOnCommit(route: PortalInstantRoute): boolean {
  return PORTAL_INSTANT_ROUTE_DEFINITIONS[route].release === 'route-commit';
}
