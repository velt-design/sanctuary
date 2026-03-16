export type PortalRole = 'admin' | 'staff';

export type PortalNavItem = {
  label: string;
  href: string;
  adminOnly?: boolean;
};

export const PORTAL_NAV_ITEMS: readonly PortalNavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Projects', href: '/staff/projects' },
  { label: 'Contacts', href: '/staff/contacts' },
  { label: 'Schedule', href: '/staff/schedule' },
  { label: 'Imports', href: '/admin/imports', adminOnly: true },
  { label: 'Pricebook', href: '/pricebook#materials', adminOnly: true },
] as const;

export function getPortalNavItems(role: PortalRole): PortalNavItem[] {
  return PORTAL_NAV_ITEMS.filter((i) => (i.adminOnly ? role === 'admin' : true));
}

export function isPortalNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href.startsWith('/pricebook') && pathname.startsWith('/pricebook')) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
