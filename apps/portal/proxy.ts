import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  buildAccessStatusHref,
  buildLoginHref,
  currentRequestPathWithSearch,
  getSafeCallbackUrl,
  type PortalAccessLookup,
  resolvePortalAccessState,
  toAccessStatusQueryState,
} from '@/lib/portalAccess';

const PUBLIC_FILE = /\.(.*)$/;
const FIXTURE_WORKBENCH_INTERNAL_PATH = '/qa/design-workbench-fixture';
const FIXTURE_WORKBENCH_STAFF_PATH = '/staff/projects/fixture-roof/design-workbench';

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

type NormalizedRoute =
  | { action: 'next'; pathname: string }
  | { action: 'rewrite'; pathname: string }
  | { action: 'redirect'; pathname: string; permanent?: boolean };

function requiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}

function isPortalPublicPath(path: string): boolean {
  return path === '/login' || path.startsWith('/login/') || path === '/access-status' || path.startsWith('/access-status/');
}

function areFixtureWorkbenchRoutesEnabled(): boolean {
  return (
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH?.trim() === '1' &&
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES?.trim() === '1'
  );
}

function isFixtureWorkbenchInternalPath(path: string): boolean {
  return path === FIXTURE_WORKBENCH_INTERNAL_PATH || path.startsWith(`${FIXTURE_WORKBENCH_INTERNAL_PATH}/`);
}

function isStaffFixtureWorkbenchRequest(req: NextRequest): boolean {
  if (req.nextUrl.pathname !== FIXTURE_WORKBENCH_STAFF_PATH) return false;
  return Boolean(req.nextUrl.searchParams.get('fixture')?.trim());
}

function isPortalProtectedPath(path: string): boolean {
  return (
    path === '/dashboard' ||
    path.startsWith('/dashboard/') ||
    path === '/staff' ||
    path.startsWith('/staff/') ||
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/pricebook' ||
    path.startsWith('/pricebook/')
  );
}

function isPricebookPath(path: string): boolean {
  return path === '/pricebook' || path.startsWith('/pricebook/');
}

function normalizePortalRoute(path: string): NormalizedRoute {
  if (path === '/staff/login' || path.startsWith('/staff/login/')) {
    const stripped = path.replace(/^\/staff\/login/, '');
    return { action: 'redirect', pathname: stripped ? `/login${stripped}` : '/login' };
  }

  if (path === '/staff/pricebook' || path.startsWith('/staff/pricebook/')) {
    const stripped = path.replace(/^\/staff\/pricebook/, '');
    return { action: 'redirect', pathname: stripped ? `/pricebook${stripped}` : '/pricebook', permanent: true };
  }

  if (path === '/imports' || path.startsWith('/imports/')) {
    const stripped = path.replace(/^\/imports/, '');
    return { action: 'rewrite', pathname: stripped ? `/admin/imports${stripped}` : '/admin/imports' };
  }

  if (path === '/') {
    return { action: 'redirect', pathname: '/dashboard', permanent: true };
  }

  if (
    path === '/staff' ||
    path.startsWith('/staff/') ||
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/pricebook' ||
    path.startsWith('/pricebook/') ||
    path === '/dashboard' ||
    path.startsWith('/dashboard/') ||
    isPortalPublicPath(path)
  ) {
    return { action: 'next', pathname: path };
  }

  return { action: 'rewrite', pathname: `/staff${path}` };
}

function withPathname(req: NextRequest, pathname: string): URL {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  return url;
}

function withLocalHref(req: NextRequest, href: string): URL {
  return new URL(href, req.url);
}

function buildNormalizedResponse(req: NextRequest, route: NormalizedRoute): NextResponse {
  const url = withPathname(req, route.pathname);

  if (route.action === 'rewrite') {
    return NextResponse.rewrite(url);
  }

  if (route.action === 'redirect') {
    return NextResponse.redirect(url, route.permanent ? 308 : 307);
  }

  return NextResponse.next();
}

function createProxySupabase(req: NextRequest) {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const cookiesToSet: CookieToSet[] = [];

  if (!url || !anonKey) {
    return {
      supabase: null,
      apply(response: NextResponse) {
        return response;
      },
    };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(nextCookies) {
        for (const cookie of nextCookies) {
          cookiesToSet.push(cookie);
        }
      },
    },
  });

  return {
    supabase: supabase as unknown as PortalAccessLookup,
    apply(response: NextResponse) {
      for (const cookie of cookiesToSet) {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
      return response;
    },
  };
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

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

  if (isFixtureWorkbenchInternalPath(path)) {
    return NextResponse.next();
  }

  if (isStaffFixtureWorkbenchRequest(req) && areFixtureWorkbenchRoutesEnabled()) {
    return NextResponse.rewrite(withPathname(req, FIXTURE_WORKBENCH_INTERNAL_PATH));
  }

  const normalized = normalizePortalRoute(path);
  if (normalized.action === 'redirect') {
    return buildNormalizedResponse(req, normalized);
  }

  const originalCallback = currentRequestPathWithSearch(req.nextUrl);
  const normalizedPath = normalized.pathname;
  const isLoginPath = normalizedPath === '/login' || normalizedPath.startsWith('/login/');
  const isAccessStatusPath = normalizedPath === '/access-status' || normalizedPath.startsWith('/access-status/');
  const isAdminPath = normalizedPath === '/admin' || normalizedPath.startsWith('/admin/');
  const isPricebookProtectedPath = isPricebookPath(normalizedPath);
  const requiresAccessCheck = isLoginPath || isAccessStatusPath || isPortalProtectedPath(normalizedPath);

  if (!requiresAccessCheck) {
    return buildNormalizedResponse(req, normalized);
  }

  const proxySupabase = createProxySupabase(req);
  if (!proxySupabase.supabase) {
    return buildNormalizedResponse(req, normalized);
  }

  const accessState = await resolvePortalAccessState(proxySupabase.supabase);

  if (isLoginPath) {
    if (accessState.kind === 'authenticated') {
      return proxySupabase.apply(NextResponse.redirect(withLocalHref(req, getSafeCallbackUrl(req.nextUrl.searchParams.get('callbackUrl')))));
    }

    if (accessState.kind === 'no_access' || accessState.kind === 'lookup_failed') {
      return proxySupabase.apply(
        NextResponse.redirect(
          withLocalHref(
            req,
            buildAccessStatusHref({
              state: toAccessStatusQueryState(accessState.kind),
              callbackUrl: req.nextUrl.searchParams.get('callbackUrl'),
            }),
          ),
        ),
      );
    }

    return proxySupabase.apply(buildNormalizedResponse(req, normalized));
  }

  if (isAccessStatusPath) {
    if (accessState.kind === 'authenticated') {
      return proxySupabase.apply(NextResponse.redirect(withLocalHref(req, getSafeCallbackUrl(req.nextUrl.searchParams.get('callbackUrl')))));
    }

    return proxySupabase.apply(buildNormalizedResponse(req, normalized));
  }

  if (accessState.kind === 'unauthenticated') {
    return proxySupabase.apply(NextResponse.redirect(withLocalHref(req, buildLoginHref(originalCallback))));
  }

  if (accessState.kind === 'no_access' || accessState.kind === 'lookup_failed') {
    return proxySupabase.apply(
      NextResponse.redirect(
        withLocalHref(
          req,
          buildAccessStatusHref({
            state: toAccessStatusQueryState(accessState.kind),
            callbackUrl: originalCallback,
          }),
        ),
      ),
    );
  }

  if ((isAdminPath || isPricebookProtectedPath) && accessState.session.role !== 'admin') {
    return proxySupabase.apply(NextResponse.redirect(withPathname(req, '/staff/calculator')));
  }

  return proxySupabase.apply(buildNormalizedResponse(req, normalized));
}

export const config = {
  matcher: ['/((?!_next|api).*)'],
};
