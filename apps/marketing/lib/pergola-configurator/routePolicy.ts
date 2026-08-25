export type ConfiguratorRoutePolicy = {
  enabled: boolean;
  initialDockVisibility: 'immediate' | 'after_engagement' | 'hidden';
  reason: string;
};

const EXCLUDED_PREFIXES = ['/quote', '/invoice', '/staff', '/admin', '/pricebook', '/api'];
const EXPERIMENT_PREFIXES = [
  '/__foundation',
  '/%5f%5ffoundation',
  '/home-experimental',
  '/home-guided',
  '/home-journey',
  '/home-project-finder',
  '/home-v2',
];
const SUCCESS_SUFFIXES = ['/thanks', '/success', '/confirmation'];
const LEGAL_ROUTES = ['/privacy', '/terms'];
const DISCOVERY_PREFIXES = ['/projects', '/products', '/pergola-guides', '/contact'];
const DISCOVERY_ROUTES = new Set([
  '/',
  '/index',
  '/acrylic-pergolas-vs-louvre-roofs',
  '/acrylic-roof-pergolas-auckland',
  '/aluminium-pergolas-auckland',
  '/architects-designers-builders',
  '/commercial-pergolas-auckland',
  '/custom-pergolas-auckland',
  '/gable-pergolas-auckland',
  '/outdoor-rooms-auckland',
  '/pergola-cost-auckland',
  '/pergolas-auckland',
  '/pergolas-with-blinds',
  '/pitched-pergolas-auckland',
  '/simple-cover-calculator',
  '/simple-pergolas-auckland',
]);

function canonicalPathname(pathname: string | null | undefined): string {
  if (!pathname) return '/';
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || '/';
  const normalized = withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery;
  return normalized.toLowerCase();
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getConfiguratorRoutePolicy(
  pathname: string | null | undefined,
): ConfiguratorRoutePolicy {
  const path = canonicalPathname(pathname);
  if (EXCLUDED_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) {
    return { enabled: false, initialDockVisibility: 'hidden', reason: 'protected_or_document_route' };
  }
  if (EXPERIMENT_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) {
    return { enabled: false, initialDockVisibility: 'hidden', reason: 'noindex_or_experiment_route' };
  }
  if (SUCCESS_SUFFIXES.some((suffix) => path.endsWith(suffix))) {
    return { enabled: false, initialDockVisibility: 'hidden', reason: 'confirmation_route' };
  }
  if (LEGAL_ROUTES.some((route) => matchesPrefix(path, route))) {
    return { enabled: false, initialDockVisibility: 'hidden', reason: 'legal_route' };
  }
  if (
    DISCOVERY_ROUTES.has(path)
    || DISCOVERY_PREFIXES.some((prefix) => matchesPrefix(path, prefix))
  ) {
    return { enabled: true, initialDockVisibility: 'after_engagement', reason: 'public_discovery_route' };
  }
  return { enabled: false, initialDockVisibility: 'hidden', reason: 'unclassified_route' };
}
