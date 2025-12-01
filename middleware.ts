import { NextRequest, NextResponse } from 'next/server';

const CANONICAL_HOST = 'www.sanctuarypergolas.co.nz';

export function middleware(req: NextRequest) {
  const { nextUrl, headers } = req;
  const host = headers.get('host') || '';
  const isLocal = /localhost|127\.0\.0\.1|\.local(:\d+)?$/i.test(host);
  const isCanonical = host.toLowerCase() === CANONICAL_HOST;

  // Force canonical host in production
  if (!isLocal && host && !isCanonical) {
    const url = new URL(nextUrl);
    url.hostname = CANONICAL_HOST;
    return NextResponse.redirect(url, 301);
  }

  // Add noindex for preview deployments if detected
  const res = NextResponse.next();
  if (/vercel\.app$/i.test(host)) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api).*)',
  ],
};

