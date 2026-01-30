import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_FILE = /\.(.*)$/;

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = (req.headers.get('host') || '').toLowerCase();
  const hostname = host.split(':')[0];

  // Never touch Next internals / API / static files
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/favicon') ||
    url.pathname === '/robots.txt' ||
    url.pathname === '/sitemap.xml' ||
    PUBLIC_FILE.test(url.pathname)
  ) {
    return NextResponse.next();
  }

  const isPortalHost =
    hostname === 'portal.sanctuarypergolas.co.nz' ||
    hostname === 'portal.localhost' ||
    hostname.startsWith('portal.');

  // Portal host: rewrite clean paths to /staff/*
  if (isPortalHost) {
    const STAFF_PREFIX = '/staff';
    const withPortalDebug = (res: NextResponse, rewrite: string) => {
      res.headers.set('x-portal-host', hostname);
      res.headers.set('x-portal-rewrite', rewrite);
      return res;
    };

    // Legacy portal links: /staff/pricebook -> /pricebook
    if (url.pathname === '/staff/pricebook' || url.pathname.startsWith('/staff/pricebook/')) {
      const stripped = url.pathname.replace(/^\/staff\/pricebook/, '');
      const dest = url.clone();
      dest.pathname = stripped ? `/pricebook${stripped}` : '/pricebook';
      return withPortalDebug(NextResponse.redirect(dest, 308), dest.pathname);
    }

    // Allow /pricebook to resolve directly on portal host
    if (url.pathname === '/pricebook' || url.pathname.startsWith('/pricebook/')) {
      return withPortalDebug(NextResponse.next(), 'no');
    }

    // Avoid double-prefix if someone visits /staff directly on portal host
    if (url.pathname === STAFF_PREFIX || url.pathname.startsWith(`${STAFF_PREFIX}/`)) {
      return withPortalDebug(NextResponse.next(), 'no');
    }

    // IMPORTANT: do NOT rewrite /admin - admin has its own routes under /admin
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      return withPortalDebug(NextResponse.next(), 'no');
    }

    url.pathname = url.pathname === '/' ? `${STAFF_PREFIX}/projects` : `${STAFF_PREFIX}${url.pathname}`;
    return withPortalDebug(NextResponse.rewrite(url), url.pathname);
  }

  // Main domain: only redirect the legacy /portal path (optional but recommended)
  if (url.pathname === '/portal' || url.pathname.startsWith('/portal/')) {
    const stripped = url.pathname.replace(/^\/portal/, '') || '/';
    const dest = new URL(`https://portal.sanctuarypergolas.co.nz${stripped}`);
    dest.search = url.search;
    return NextResponse.redirect(dest, 308);
  }

  // Main domain marketing: do nothing
  const res = NextResponse.next();
  res.headers.set('x-portal-host', hostname);
  res.headers.set('x-portal-rewrite', 'no');
  return res;
}

export const config = {
  matcher: ['/((?!_next|api).*)'],
};
