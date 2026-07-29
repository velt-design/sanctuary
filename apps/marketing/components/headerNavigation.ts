type HeaderNavigationItem = {
  id: 'home' | 'projects' | 'products' | 'commercial' | 'professional' | 'contact';
  label: string;
  desktopLabel?: string;
  href: string;
  current: boolean;
};

type PrimaryNavigationItem = {
  id: HeaderNavigationItem['id'];
  label: string;
  mobileLabel?: string;
  href: string;
  matches: (pathname: string) => boolean;
};

const primaryNavigationItems: readonly PrimaryNavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    matches: (pathname) => pathname === '/',
  },
  {
    id: 'projects',
    label: 'Projects',
    href: '/projects',
    matches: (pathname) => pathname === '/projects' || pathname.startsWith('/projects/'),
  },
  {
    id: 'products',
    label: 'Products',
    mobileLabel: 'Pergola options',
    href: '/products',
    matches: (pathname) => pathname === '/products' || pathname.startsWith('/products/'),
  },
  {
    id: 'commercial',
    label: 'Commercial',
    href: '/commercial-pergolas-auckland',
    matches: (pathname) => pathname === '/commercial-pergolas-auckland',
  },
  {
    id: 'professional',
    label: 'Professionals',
    href: '/architects-designers-builders',
    matches: (pathname) => pathname === '/architects-designers-builders',
  },
  {
    id: 'contact',
    label: 'Contact',
    href: '/contact',
    matches: (pathname) => pathname === '/contact',
  },
];

const heroOverlayPaths = new Set([
  '/',
  '/pergola-guides',
  '/pergolas-auckland',
  '/custom-pergolas-auckland',
  '/aluminium-pergolas-auckland',
  '/pergola-cost-auckland',
  '/gable-pergolas-auckland',
  '/pitched-pergolas-auckland',
  '/outdoor-rooms-auckland',
  '/pergolas-with-blinds',
  '/acrylic-pergolas-vs-louvre-roofs',
  '/commercial-pergolas-auckland',
]);

export function getCanonicalHeaderPathname(
  pathname: string | null,
): string {
  // Next's production static render can expose the public root as its
  // filesystem alias. Header state and enquiry context must use the public URL.
  return !pathname || pathname === '/index' ? '/' : pathname;
}

export function isHeaderHeroOverlayPath(pathname: string): boolean {
  return heroOverlayPaths.has(pathname);
}

function toNavigationItem(
  item: PrimaryNavigationItem,
  pathname: string,
  mobile = false,
): HeaderNavigationItem {
  return {
    id: item.id,
    label: mobile ? (item.mobileLabel ?? item.label) : item.label,
    desktopLabel: item.label,
    href: item.href,
    current: item.matches(pathname),
  };
}

export function getDesktopHeaderNavigation(
  pathname: string,
): HeaderNavigationItem[] {
  return primaryNavigationItems.map((item) => toNavigationItem(item, pathname));
}

export function getMobileHeaderNavigation(
  pathname: string,
): HeaderNavigationItem[] {
  return primaryNavigationItems
    .filter((item) => item.id !== 'home' && item.id !== 'contact')
    .map((item) => toNavigationItem(item, pathname, true));
}
