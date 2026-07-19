import type { ProjectsIndexArchiveFilter } from './projectsIndex';
import {
  openPortalIndexInstantly,
  portalIndexOpeningHref,
  portalIndexTarget,
  projectsArchiveFromPortalIndexTarget,
} from './portalIndexNavigation';

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
  replace(href: string, options?: { scroll?: boolean }): void;
};

export function projectsIndexTarget(href: string, base?: string | URL): URL | null {
  const target = portalIndexTarget(href, base);
  return target?.route === 'projects-index' ? target.url : null;
}

export function projectsIndexArchiveFromHref(href: string, base?: string | URL): ProjectsIndexArchiveFilter {
  const target = portalIndexTarget(href, base);
  return target?.route === 'projects-index' ? projectsArchiveFromPortalIndexTarget(target) : 'active';
}

export function projectsIndexOpeningHref(href: string, base?: string | URL): string | null {
  return projectsIndexTarget(href, base) ? portalIndexOpeningHref(href, base) : null;
}

export function openProjectsIndexInstantly(
  event: ProjectsIndexClickEvent,
  router: Pick<ProjectsIndexRouter, 'replace'>,
  href: string,
): boolean {
  return openPortalIndexInstantly(event, router, href) === 'projects-index';
}
