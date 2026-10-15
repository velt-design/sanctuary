import { isGoogleFunnelPath } from '../lib/googleFunnel';
const shelllessRoutePrefixes = [
  '/design-enquiry',
  '/quote',
  '/invoice',
  '/staff',
  '/admin',
  '/pricebook',
] as const;

function matchesRouteOrChild(
  pathname: string,
  route: string,
): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function shouldHideMarketingHeader(
  pathname: string | null,
): boolean {
  if (!pathname) return false;
  return isGoogleFunnelPath(pathname) || pathname === '/home-journey'
    || shelllessRoutePrefixes.some((route) =>
      matchesRouteOrChild(pathname, route),
    );
}

export function shouldHideMarketingFooter(
  pathname: string | null,
): boolean {
  if (!pathname) return false;
  return isGoogleFunnelPath(pathname) || pathname === '/home-journey'
    || pathname === '/projects'
    || shelllessRoutePrefixes.some((route) =>
      matchesRouteOrChild(pathname, route),
    );
}

