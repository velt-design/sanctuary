export const PORTAL_WEB_VITAL_NAMES = ['CLS', 'FCP', 'INP', 'LCP', 'TTFB'] as const;
export const PORTAL_WEB_VITAL_RATINGS = ['good', 'needs-improvement', 'poor'] as const;
const PORTAL_PERFORMANCE_DEVICE_CLASSES = ['desktop', 'tablet', 'mobile'] as const;
export const PORTAL_PERFORMANCE_NAVIGATION_TYPES = [
  'navigate',
  'reload',
  'back-forward',
  'back-forward-cache',
  'prerender',
  'restore',
] as const;
const PORTAL_ROUTE_TEMPLATES = [
  '/dashboard',
  '/staff/projects',
  '/staff/projects/[projectId]',
  '/staff/projects/[projectId]/design-workbench',
  '/staff/projects/design-packages',
  '/staff/projects/running-jobs',
  '/staff/contacts',
  '/staff/contacts/[contactId]',
  '/staff/schedule',
  '/staff/calculator',
  '/admin',
] as const;

export type PortalWebVitalName = (typeof PORTAL_WEB_VITAL_NAMES)[number];
export type PortalWebVitalRating = (typeof PORTAL_WEB_VITAL_RATINGS)[number];
type PortalPerformanceDeviceClass = (typeof PORTAL_PERFORMANCE_DEVICE_CLASSES)[number];
export type PortalPerformanceNavigationType = (typeof PORTAL_PERFORMANCE_NAVIGATION_TYPES)[number];
type PortalRouteTemplate = (typeof PORTAL_ROUTE_TEMPLATES)[number];

export type PortalWebVitalEvent = {
  name: PortalWebVitalName;
  value: number;
  rating: PortalWebVitalRating;
  routeTemplate: PortalRouteTemplate;
  navigationType: PortalPerformanceNavigationType;
  deviceClass: PortalPerformanceDeviceClass;
  buildId?: string;
};

export const PORTAL_WEB_VITAL_MAX_BYTES = 2_048;
const PORTAL_WEB_VITAL_MAX_VALUE = 600_000;
const BUILD_ID_PATTERN = /^[a-zA-Z0-9._-]{1,128}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function oneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

export function portalRouteTemplate(pathname: string | null | undefined): PortalRouteTemplate | null {
  if (!pathname) return null;
  if (pathname === '/dashboard') return '/dashboard';
  if (pathname === '/staff/projects/design-packages') return '/staff/projects/design-packages';
  if (pathname === '/staff/projects/running-jobs' || pathname === '/staff/running-jobs') {
    return '/staff/projects/running-jobs';
  }
  if (/^\/staff\/projects\/[^/]+\/design-workbench(?:\/|$)/.test(pathname)) {
    return '/staff/projects/[projectId]/design-workbench';
  }
  if (/^\/staff\/projects\/[^/]+(?:\/|$)/.test(pathname)) return '/staff/projects/[projectId]';
  if (pathname === '/staff/projects') return '/staff/projects';
  if (/^\/staff\/contacts\/[^/]+(?:\/|$)/.test(pathname)) return '/staff/contacts/[contactId]';
  if (pathname === '/staff/contacts') return '/staff/contacts';
  if (pathname === '/staff/schedule' || pathname.startsWith('/staff/schedule/')) return '/staff/schedule';
  if (pathname === '/staff/calculator' || pathname.startsWith('/staff/calculator/')) return '/staff/calculator';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return '/admin';
  return null;
}

export function portalPerformanceDeviceClass(width: number): PortalPerformanceDeviceClass {
  if (width < 768) return 'mobile';
  if (width < 1200) return 'tablet';
  return 'desktop';
}

export function estimatePortalWebVitalBytes(input: unknown): number {
  try {
    const serialized = typeof input === 'string' ? input : JSON.stringify(input);
    return typeof TextEncoder === 'undefined' ? serialized.length : new TextEncoder().encode(serialized).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function sanitizePortalWebVitalEvent(input: unknown): PortalWebVitalEvent | null {
  if (!isRecord(input)) return null;
  if (!oneOf(PORTAL_WEB_VITAL_NAMES, input.name)) return null;
  if (!oneOf(PORTAL_WEB_VITAL_RATINGS, input.rating)) return null;
  if (!oneOf(PORTAL_ROUTE_TEMPLATES, input.routeTemplate)) return null;
  if (!oneOf(PORTAL_PERFORMANCE_NAVIGATION_TYPES, input.navigationType)) return null;
  if (!oneOf(PORTAL_PERFORMANCE_DEVICE_CLASSES, input.deviceClass)) return null;
  if (
    typeof input.value !== 'number' ||
    !Number.isFinite(input.value) ||
    input.value < 0 ||
    input.value > PORTAL_WEB_VITAL_MAX_VALUE
  ) {
    return null;
  }

  const event: PortalWebVitalEvent = {
    name: input.name,
    value: Number(input.value.toFixed(3)),
    rating: input.rating,
    routeTemplate: input.routeTemplate,
    navigationType: input.navigationType,
    deviceClass: input.deviceClass,
  };
  if (typeof input.buildId === 'string' && BUILD_ID_PATTERN.test(input.buildId)) {
    event.buildId = input.buildId;
  }
  return estimatePortalWebVitalBytes(event) <= PORTAL_WEB_VITAL_MAX_BYTES ? event : null;
}
