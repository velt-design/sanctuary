import type { QueryClient } from '@tanstack/react-query';
import { shouldHandleRouteTransitionClick, shouldStartRouteTransitionForHref, type PortalRouteTransitionContextValue } from '@/components/page-state/PortalRouteTransitionContext';
import type { PortalInstantRoute } from '@/components/page-state/PortalRouteTransition';
import type { ProjectsIndexArchiveFilter } from './projectsIndex';
import { resolveProjectIndexReturnHref } from '@/lib/projects/projectIndexSession';
import { publicFramePath } from '@/components/page-state/PortalPageSource';
import {portalInstantRouteTarget} from '@/lib/portalInstantRoutes';

const PORTAL_INDEX_OPENING_PARAM = '__portal_opening';

type PortalIndexClickEvent = {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  preventDefault(): void;
  currentTarget?: EventTarget | null;
};

type PortalIndexRouter = {
  prefetch(href: string): void;
  replace(href: string, options?: { scroll?: boolean }): void;
};

type PortalIndexTarget = { route: PortalInstantRoute; url: URL };

export function portalIndexTarget(href: string, base?: string | URL): PortalIndexTarget | null {
  try {
    const current = base ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    const url = new URL(href, current);
    if (url.origin !== new URL(current).origin) return null;
    if (url.pathname === '/staff/projects') return { route: 'projects-index', url };
    if (url.pathname === '/staff/contacts') return { route: 'contacts-index', url };
    return null;
  } catch {
    return null;
  }
}

export function projectsArchiveFromPortalIndexTarget(target: PortalIndexTarget): ProjectsIndexArchiveFilter {
  const raw = target.url.searchParams.get('archive')?.trim().toLowerCase();
  return raw === 'archived' || raw === 'all' ? raw : 'active';
}

export function portalIndexOpeningHref(href: string, base?: string | URL): string | null {
  const target = portalIndexTarget(href, base);
  if (!target) return null;
  target.url.searchParams.set(PORTAL_INDEX_OPENING_PARAM, target.route);
  return `${target.url.pathname}${target.url.search}${target.url.hash}`;
}

export function preloadPortalIndex(
  queryClient: QueryClient,
  router: Pick<PortalIndexRouter, 'prefetch'>,
  href: string,
): PortalInstantRoute | null {
  href = resolveProjectIndexReturnHref(href);
  const target = portalIndexTarget(href);
  if (!target) return null;
  router.prefetch(href);
  // Index records mount only after the selected guarded leaf is adopted.
  return target.route;
}

export function openPortalIndexInstantly(
  event: PortalIndexClickEvent,
  router: Pick<PortalIndexRouter, 'replace'>,
  href: string,
): PortalInstantRoute | null {
  href = resolveProjectIndexReturnHref(href);
  const target = portalIndexTarget(href);
  const openingHref = portalIndexOpeningHref(href);
  if (!target || !openingHref || !shouldHandleRouteTransitionClick(event)) return null;
  event.preventDefault();
  window.history.pushState(null, '', openingHref);
  router.replace(href, { scroll: false });
  return target.route;
}

/** The Schedule frame shares the accepted index history handoff, not its API prefetch. */
export function openPortalScheduleInstantly(
  event: PortalIndexClickEvent,
  router: Pick<PortalIndexRouter, 'replace'>,
  href: string,
): boolean {
  if(publicFramePath(href,window.location.href)!=='/staff/schedule')return false;
  return openPortalActualFrameInstantly(event,router,href);
}

/** Reuse the accepted index history handoff for the seven actual public frames. */
export function openPortalActualFrameInstantly(
  event:PortalIndexClickEvent,router:Pick<PortalIndexRouter,'replace'>,href:string,
):boolean{
  if (!shouldHandleRouteTransitionClick(event) || !shouldStartRouteTransitionForHref(href)
    || !publicFramePath(href, window.location.href)) return false;
  const target = new URL(href, window.location.href);
  const route=portalInstantRouteTarget(href,window.location.href);
  if(!route)return false;
  target.searchParams.set(PORTAL_INDEX_OPENING_PARAM, route.route);
  event.preventDefault();
  window.history.pushState(null, '', `${target.pathname}${target.search}${target.hash}`);
  router.replace(href, { scroll: false });
  return true;
}

/** Shared sidebar intent; each visible navigation owner retains its own controls. */
export function handlePortalNavigationClick(
  event: PortalIndexClickEvent,
  router: Pick<PortalIndexRouter, 'replace'>,
  href: string,
  { beginInstantRoute, beginRouteTransition }: Pick<PortalRouteTransitionContextValue, 'beginInstantRoute' | 'beginRouteTransition'>,
  { label, source, control }: { label: string; source: 'sidebar-panel' | 'sidebar-rail'; control: HTMLElement },
): void {
  if (!shouldHandleRouteTransitionClick(event)) return;
  if (!shouldStartRouteTransitionForHref(href)) return;
  const indexTarget = portalIndexTarget(href);
  if (indexTarget) {
    beginInstantRoute(indexTarget.route, { href });
    if (openPortalIndexInstantly(event, router, href)) return;
  }
  beginRouteTransition({ href, label, source, control });
  openPortalActualFrameInstantly(event, router, href);
}

/** Code preparation only; the caller owns the lifetime of its deduplication set. */
export function preloadPortalNavigation(
  queryClient: QueryClient,
  router: Pick<PortalIndexRouter, 'prefetch'>,
  href: string,
  prefetched: Set<string>,
): void {
  if (portalIndexTarget(href)) {
    preloadPortalIndex(queryClient, router, href);
    return;
  }
  const routeToken = `route:${href}`;
  if (!prefetched.has(routeToken)) {
    prefetched.add(routeToken);
    router.prefetch(href);
  }
  // Schedule data belongs to the guarded selected read owner.
}
