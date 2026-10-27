import { NextRequest, NextResponse } from 'next/server';
import { createProxySupabase } from '@/lib/supabase/proxyClient';
import { isRegionalDocumentPath, isRegionalNavigationPath, prepareRegionalPageAccess } from '@/lib/regionalDocumentAccess';
import { DOCUMENT_ID_HEADER, prepareProxyDocumentDiagnostics } from '@/lib/performance/documentDiagnostics';
import type { PortalAccessTimingObserver } from '@/lib/portalAccess';
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
const PROJECT_MUTATION_FIXTURE_PATH = '/qa/projects-index-mutation-fixture';
const PROJECT_COMMAND_CENTRE_FIXTURE_PATH = '/qa/project-command-centre-fixture';
const COMMERCIAL_WORKFLOW_FIXTURE_PATH = '/qa/commercial-workflow-fixture';
const PROJECT_PAGE_SHELL_FIXTURE_PATH = '/qa/project-page-shell-fixture';
const UI_FOUNDATION_FIXTURE_PATH = '/qa/ui-foundation-fixture';
const EMAIL_PREVIEW_WORKBENCH_FIXTURE_PATH = '/qa/email-preview-workbench-fixture';
const DESIGN_BOOKLET_WORKBENCH_FIXTURE_PATH = '/qa/design-booklet-workbench-fixture';
const INVOICE_ARTIFACT_PREVIEW_FIXTURE_PATH = '/qa/invoice-artifact-preview-fixture';
const INVOICE_DRAFT_EDITOR_FIXTURE_PATH = '/qa/invoice-draft-editor-fixture';
const PROJECT_WORK_QUEUE_FIXTURE_PATH = '/qa/project-work-queue-fixture';
const SCHEDULE_OPS_FIXTURE_PATH = '/qa/schedule-ops-fixture';
const AI_ACTIVITY_FIXTURE_PATH = '/qa/ai-activity-fixture';

type NormalizedRoute =
  | { action: 'next'; pathname: string }
  | { action: 'rewrite'; pathname: string }
  | { action: 'redirect'; pathname: string; permanent?: boolean };

function isPortalPublicPath(path: string): boolean {
  return path === '/login' || path.startsWith('/login/') || path === '/access-status' || path.startsWith('/access-status/');
}

function areFixtureWorkbenchRoutesEnabled(): boolean {
  return process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES?.trim() === '1';
}

function isFixtureWorkbenchInternalPath(path: string): boolean {
  return path === FIXTURE_WORKBENCH_INTERNAL_PATH || path.startsWith(`${FIXTURE_WORKBENCH_INTERNAL_PATH}/`);
}

function isPortalQaFixtureInternalPath(path: string): boolean {
  return (
    isFixtureWorkbenchInternalPath(path) ||
    path === PROJECT_MUTATION_FIXTURE_PATH ||
    path === PROJECT_COMMAND_CENTRE_FIXTURE_PATH ||
    path === COMMERCIAL_WORKFLOW_FIXTURE_PATH ||
    path === PROJECT_PAGE_SHELL_FIXTURE_PATH ||
    /^\/qa\/project-page-shell-fixture\/files\/[a-z0-9-]+$/.test(path) ||
    path === UI_FOUNDATION_FIXTURE_PATH ||
    path === EMAIL_PREVIEW_WORKBENCH_FIXTURE_PATH ||
    path === '/qa/installer-payout' ||
    path === DESIGN_BOOKLET_WORKBENCH_FIXTURE_PATH ||
    path === INVOICE_ARTIFACT_PREVIEW_FIXTURE_PATH ||
    path === INVOICE_DRAFT_EDITOR_FIXTURE_PATH ||
    path === '/qa/invoice-restore-fixture' ||
    path === '/qa/revised-quote-fixture' ||
    path === '/qa/finance-register' ||
    path === PROJECT_WORK_QUEUE_FIXTURE_PATH ||
    path === SCHEDULE_OPS_FIXTURE_PATH ||
    path === '/qa/schedule-progressive-fixture' ||
    path === '/qa/portal-progressive-fixture' ||
    path === '/qa/portal-progressive-fixture/dashboard-read' ||
    path === AI_ACTIVITY_FIXTURE_PATH ||
    path === '/qa/email-review-fixture' ||
    path === '/qa/finance-payment-fixture' ||
    path === '/qa/xero-summary-fixture' ||
    path === '/qa/enquiry-qualification-fixture' ||
    path === '/qa/marketing-performance-fixture' ||
    path === '/qa/marketing-performance-fixture/project' ||
    path === '/qa/marketing-performance-fixture/financial-read'
  );
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
    return {
      action: 'redirect',
      pathname: stripped ? `/login${stripped}` : '/login',
    };
  }

  if (path === '/staff/pricebook' || path.startsWith('/staff/pricebook/')) {
    const stripped = path.replace(/^\/staff\/pricebook/, '');
    return {
      action: 'redirect',
      pathname: stripped ? `/pricebook${stripped}` : '/pricebook',
      permanent: true,
    };
  }

  if (path === '/imports' || path.startsWith('/imports/')) {
    const stripped = path.replace(/^\/imports/, '');
    return {
      action: 'rewrite',
      pathname: stripped ? `/admin/imports${stripped}` : '/admin/imports',
    };
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

function buildNormalizedResponse(req: NextRequest, route: NormalizedRoute, requestHeaders?: Headers): NextResponse {
  const url = withPathname(req, route.pathname);
  const init = requestHeaders ? { request: { headers: requestHeaders } } : undefined;

  if (route.action === 'rewrite') {
    return NextResponse.rewrite(url, init);
  }

  if (route.action === 'redirect') {
    return NextResponse.redirect(url, route.permanent ? 308 : 307);
  }

  return NextResponse.next(init);
}

export async function middleware(req: NextRequest) {
  const startedAt = performance.now();
  const { requestHeaders, diagnostics } = prepareProxyDocumentDiagnostics(req);
  try {
    const document = prepareRegionalPageAccess(req, requestHeaders);
    let response: NextResponse;
    if (document.eligible) {
      const transport = createProxySupabase(req);
      // Session contents are untrusted. This only renews cookie transport;
      // root/staff/page helpers still verify getUser + current role regionally.
      await transport.supabase?.auth.getSession();
      response = transport.apply(NextResponse.next({ request: { headers: transport.forwardRefreshedCookies(document.headers) } }));
    } else {
      response = await runProxy(req, document.headers, diagnostics?.accessObserver('proxy'));
    }
    // Denials and non-document variants of these private pages must not be cached.
    if (isRegionalDocumentPath(req.nextUrl.pathname) || isRegionalNavigationPath(req.nextUrl.pathname)) response.headers.set('Cache-Control', 'private, no-store');
    diagnostics?.record('proxy.complete', startedAt, response.status >= 300 && response.status < 400 ? 'redirect' : 'complete');
    if (diagnostics) response.headers.set(DOCUMENT_ID_HEADER, diagnostics.id);
    return response;
  } catch (error) { diagnostics?.record('proxy.complete', startedAt, 'error'); throw error; }
}

async function runProxy(req: NextRequest, requestHeaders?: Headers, observer?: PortalAccessTimingObserver) {
  const path = req.nextUrl.pathname;
  const init = requestHeaders ? { request: { headers: requestHeaders } } : undefined;

  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.startsWith('/favicon') ||
    path === '/robots.txt' ||
    path === '/sitemap.xml' ||
    PUBLIC_FILE.test(path)
  ) {
    return NextResponse.next(init);
  }

  if (isPortalQaFixtureInternalPath(path)) {
    return NextResponse.next(init);
  }

  if (isStaffFixtureWorkbenchRequest(req) && areFixtureWorkbenchRoutesEnabled()) {
    return NextResponse.rewrite(withPathname(req, FIXTURE_WORKBENCH_INTERNAL_PATH), init);
  }

  const normalized = normalizePortalRoute(path);
  if (normalized.action === 'redirect') {
    return buildNormalizedResponse(req, normalized, requestHeaders);
  }

  const originalCallback = currentRequestPathWithSearch(req.nextUrl);
  const normalizedPath = normalized.pathname;
  const isLoginPath = normalizedPath === '/login' || normalizedPath.startsWith('/login/');
  const isAccessStatusPath = normalizedPath === '/access-status' || normalizedPath.startsWith('/access-status/');
  const isAdminPath = normalizedPath === '/admin' || normalizedPath.startsWith('/admin/');
  const isPricebookProtectedPath = isPricebookPath(normalizedPath);
  const requiresAccessCheck = isLoginPath || isAccessStatusPath || isPortalProtectedPath(normalizedPath);

  if (!requiresAccessCheck) {
    return buildNormalizedResponse(req, normalized, requestHeaders);
  }

  const proxySupabase = createProxySupabase(req);
  if (!proxySupabase.supabase) {
    return buildNormalizedResponse(req, normalized, requestHeaders);
  }

  const accessState = await resolvePortalAccessState(proxySupabase.supabase as unknown as PortalAccessLookup, observer);

  if (isLoginPath) {
    if (accessState.kind === 'authenticated') {
      return proxySupabase.apply(
        NextResponse.redirect(withLocalHref(req, getSafeCallbackUrl(req.nextUrl.searchParams.get('callbackUrl'))))
      );
    }

    if (accessState.kind === 'no_access' || accessState.kind === 'lookup_failed') {
      return proxySupabase.apply(
        NextResponse.redirect(
          withLocalHref(
            req,
            buildAccessStatusHref({
              state: toAccessStatusQueryState(accessState.kind),
              callbackUrl: req.nextUrl.searchParams.get('callbackUrl'),
            })
          )
        )
      );
    }

    return proxySupabase.apply(buildNormalizedResponse(req, normalized, requestHeaders));
  }

  if (isAccessStatusPath) {
    if (accessState.kind === 'authenticated') {
      return proxySupabase.apply(
        NextResponse.redirect(withLocalHref(req, getSafeCallbackUrl(req.nextUrl.searchParams.get('callbackUrl'))))
      );
    }

    return proxySupabase.apply(buildNormalizedResponse(req, normalized, requestHeaders));
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
          })
        )
      )
    );
  }

  if ((isAdminPath || isPricebookProtectedPath) && accessState.session.role !== 'admin') {
    return proxySupabase.apply(NextResponse.redirect(withPathname(req, '/staff/calculator')));
  }

  return proxySupabase.apply(buildNormalizedResponse(req, normalized, requestHeaders));
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next|api).*)'],
};
