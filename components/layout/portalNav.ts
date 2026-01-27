export type PortalRole = 'admin' | 'staff';

export type PortalNavItem = {
  label: string;
  href: string;
  adminOnly?: boolean;
};

export const PORTAL_NAV_ITEMS: readonly PortalNavItem[] = [
  { label: 'Projects', href: '/staff/projects' },
  { label: 'Contacts', href: '/staff/contacts' },
  { label: 'Schedule', href: '/staff/schedule' },
  { label: 'Calculator', href: '/staff/calculator' },
  { label: 'Imports', href: '/admin/imports', adminOnly: true },
  { label: 'Pricebook', href: '/admin/costs/materials', adminOnly: true },
  { label: 'Actions', href: '/admin/costs/actions', adminOnly: true },
  { label: 'Overheads', href: '/admin/costs/overheads', adminOnly: true },
] as const;

export function getPortalNavItems(role: PortalRole): PortalNavItem[] {
  return PORTAL_NAV_ITEMS.filter((i) => (i.adminOnly ? role === 'admin' : true));
}

export function isPortalNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

