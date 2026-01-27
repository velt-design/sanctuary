import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const CANONICAL_HOST = 'www.sanctuarypergolas.co.nz';

function isStaffPath(pathname: string): boolean {
  return pathname === '/staff' || pathname.startsWith('/staff/');
}

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export async function proxy(req: NextRequest) {
  const { nextUrl, headers } = req;
  const host = headers.get('host') || '';
  const isLocal = /localhost|127\.0\.0\.1|\.local(:\d+)?$/i.test(host);
  const isCanonical = host.toLowerCase() === CANONICAL_HOST;
  const isVercelHost = /vercel\.app$/i.test(host);
  const isProd = process.env.VERCEL_ENV === 'production';

  // Force canonical host only in production and not on Vercel preview domains
  if (isProd && !isLocal && !isVercelHost && host && !isCanonical) {
    const url = new URL(nextUrl);
    url.hostname = CANONICAL_HOST;
    return NextResponse.redirect(url, 301);
  }

  // Protect staff + admin routes.
  if (isStaffPath(nextUrl.pathname) || isAdminPath(nextUrl.pathname)) {
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    const token = secret ? await getToken({ req, secret }) : null;
    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', `${nextUrl.pathname}${nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    if (isAdminPath(nextUrl.pathname) && (token as any).role !== 'admin') {
      return NextResponse.redirect(new URL('/staff/calculator', req.url));
    }
  }

  // Add noindex for preview deployments if detected
  const res = NextResponse.next();
  if (isVercelHost) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api).*)',
  ],
};
