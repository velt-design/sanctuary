import type { QueryClient } from '@tanstack/react-query';
import { shouldHandleRouteTransitionClick } from '@/components/page-state/PortalRouteTransition';
import { projectsIndexQueryOptions, type ProjectsIndexArchiveFilter } from './projectsIndex';

const PROJECTS_INDEX_OPENING_PARAM = '__portal_opening';

type ProjectsIndexClickEvent = {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  preventDefault(): void;
  currentTarget?: EventTarget | null;
};

type ProjectsIndexRouter = {
  prefetch(href: string): void;
  replace(href: string, options?: { scroll?: boolean }): void;
};

export function projectsIndexTarget(href: string, base?: string | URL): URL | null {
  try {
    const current = base ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    const url = new URL(href, current);
    const currentOrigin = new URL(current).origin;
    if (url.origin !== currentOrigin || url.pathname !== '/staff/projects') return null;
    return url;
  } catch {
    return null;
  }
}

export function projectsIndexArchiveFromHref(href: string, base?: string | URL): ProjectsIndexArchiveFilter {
  const raw = projectsIndexTarget(href, base)?.searchParams.get('archive')?.trim().toLowerCase();
  return raw === 'archived' || raw === 'all' ? raw : 'active';
}

export function projectsIndexOpeningHref(href: string, base?: string | URL): string | null {
  const url = projectsIndexTarget(href, base);
  if (!url) return null;
  url.searchParams.set(PROJECTS_INDEX_OPENING_PARAM, 'projects-index');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function preloadProjectsIndex(
  queryClient: QueryClient,
  router: Pick<ProjectsIndexRouter, 'prefetch'>,
  href: string,
): boolean {
  if (!projectsIndexTarget(href)) return false;
  router.prefetch(href);
  void queryClient.prefetchQuery(projectsIndexQueryOptions(projectsIndexArchiveFromHref(href)));
  return true;
}

export function openProjectsIndexInstantly(
  event: ProjectsIndexClickEvent,
  router: Pick<ProjectsIndexRouter, 'replace'>,
  href: string,
): boolean {
  const openingHref = projectsIndexOpeningHref(href);
  if (!openingHref || !shouldHandleRouteTransitionClick(event)) return false;
  event.preventDefault();
  window.history.pushState(null, '', openingHref);
  router.replace(href, { scroll: false });
  return true;
}
