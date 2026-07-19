import type { QueryClient } from '@tanstack/react-query';
import { projectPageSnapshotQueryOptions } from './projects';

type ProjectRoutePreloader = {
  prefetch(href: string): void;
};

export function projectDetailHref(projectId: string): string {
  return `/staff/projects/${encodeURIComponent(projectId)}`;
}

export function preloadProjectOpen(
  queryClient: QueryClient,
  router: ProjectRoutePreloader,
  host: string,
  projectId: string,
): Promise<void> {
  router.prefetch(projectDetailHref(projectId));
  return queryClient.prefetchQuery(projectPageSnapshotQueryOptions(host, projectId));
}
