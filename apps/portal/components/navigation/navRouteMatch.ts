/** Shared parent highlighting for the expanded sidebar and its compact rail. */
export function isNavParentActive(pathname: string, href: string) {
  // Presentation alias only; the local Finance fixture retains its server gate.
  if (pathname === '/qa/finance-register' && href === '/staff/payments') return true;
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;

  const aliases: Record<string, string[]> = {
    '/staff/projects': ['/projects'],
    '/contacts': ['/staff/contacts'],
    '/schedule': ['/staff/schedule', '/staff/site-visits'],
    '/staff/schedule': ['/schedule', '/staff/site-visits'],
    '/imports': ['/admin/imports'],
    '/pricebook': ['/admin/costing', '/admin/costs'],
  };
  return aliases[href]?.some(match => pathname === match || pathname.startsWith(`${match}/`)) ?? false;
}
