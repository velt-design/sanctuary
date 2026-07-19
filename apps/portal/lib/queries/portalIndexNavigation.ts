import type { QueryClient } from '@tanstack/react-query';
import { shouldHandleRouteTransitionClick } from '@/components/page-state/PortalRouteTransition';
import type { PortalInstantRoute } from '@/components/page-state/PortalRouteTransition';
import { contactsIndexQueryOptions } from './contactsIndex';
import { projectsIndexQueryOptions, type ProjectsIndexArchiveFilter } from './projectsIndex';

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
  const target = portalIndexTarget(href);
  if (!target) return null;
  router.prefetch(href);
  if (target.route === 'projects-index') {
    void queryClient.prefetchQuery(projectsIndexQueryOptions(projectsArchiveFromPortalIndexTarget(target)));
  } else {
    void queryClient.prefetchQuery(contactsIndexQueryOptions());
  }
  return target.route;
}

export function openPortalIndexInstantly(
  event: PortalIndexClickEvent,
  router: Pick<PortalIndexRouter, 'replace'>,
  href: string,
): PortalInstantRoute | null {
  const target = portalIndexTarget(href);
  const openingHref = portalIndexOpeningHref(href);
  if (!target || !openingHref || !shouldHandleRouteTransitionClick(event)) return null;
  event.preventDefault();
  window.history.pushState(null, '', openingHref);
  router.replace(href, { scroll: false });
  return target.route;
}
