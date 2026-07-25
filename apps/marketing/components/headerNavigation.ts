import { buildEnquiryHref } from '../lib/enquiryContext';

type HeaderNavigationItem = {
  id: 'home' | 'projects' | 'products' | 'commercial' | 'professional' | 'contact';
  label: string;
  desktopLabel?: string;
  href: string;
  current: boolean;
};

type PrimaryNavigationItem = {
  id: 'home' | 'projects' | 'products' | 'contact';
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
    id: 'contact',
    label: 'Contact',
    href: '/contact',
    matches: (pathname) => pathname === '/contact',
  },
];

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
  const [home, projects, products, contact] = primaryNavigationItems.map((item) => (
    toNavigationItem(item, pathname, true)
  ));

  return [
    home,
    projects,
    products,
    {
      id: 'commercial',
      label: 'Commercial',
      href: '/commercial-pergolas-auckland',
      current: pathname === '/commercial-pergolas-auckland',
    },
    {
      id: 'professional',
      label: 'Architects, designers & builders',
      href: buildEnquiryHref({
        enquiryType: 'professional',
        sourcePath: pathname,
        sourceComponent: 'header',
      }),
      current: false,
    },
    contact,
  ];
}
