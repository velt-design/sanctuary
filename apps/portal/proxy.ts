import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_FILE = /\.(.*)$/;

export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  // Never touch Next internals / API / static files
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.startsWith('/favicon') ||
    path === '/robots.txt' ||
    path === '/sitemap.xml' ||
    PUBLIC_FILE.test(path)
  ) {
    return NextResponse.next();
  }

  // Legacy: /staff/pricebook -> /pricebook
  if (path === '/staff/pricebook' || path.startsWith('/staff/pricebook/')) {
    const stripped = path.replace(/^\/staff\/pricebook/, '');
    url.pathname = stripped ? `/pricebook${stripped}` : '/pricebook';
    return NextResponse.redirect(url, 308);
  }

  // Clean: /imports -> /admin/imports
  if (path === '/imports' || path.startsWith('/imports/')) {
    const stripped = path.replace(/^\/imports/, '');
    url.pathname = stripped ? `/admin/imports${stripped}` : '/admin/imports';
    return NextResponse.rewrite(url);
  }

  // Keep these routes as-is
  if (
    path === '/staff' || path.startsWith('/staff/') ||
    path === '/admin' || path.startsWith('/admin/') ||
    path === '/pricebook' || path.startsWith('/pricebook/') ||
    path === '/dashboard' || path.startsWith('/dashboard/') ||
    path === '/login' || path.startsWith('/login/')
  ) {
    return NextResponse.next();
  }

  // Clean root -> staff projects
  if (path === '/') {
    url.pathname = '/dashboard';
    return NextResponse.redirect(url, 308);
  }

  // Clean paths -> /staff/*
  url.pathname = `/staff${path}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next|api).*)'],
};
