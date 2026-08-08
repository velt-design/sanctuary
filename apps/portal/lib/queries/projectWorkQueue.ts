import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { apiJson } from '@/lib/repo/apiClient';
import type { ProjectWorkQueueEntry } from '@/lib/projects/workItems/types';
import { qk } from './keys';

export type ProjectWorkQueueResponse = {
  entries: ProjectWorkQueueEntry[];
  generatedAt: string;
};

const WORK_QUEUE_HANDOFF_FRESHNESS_MS = 5_000;
const ONE_DAY = 24 * 60 * 60 * 1_000;
export const PROJECT_WORK_QUEUE_HREF = '/staff/projects/work-queue';

export const projectWorkQueueQueryOptions = (host: string) =>
  queryOptions({
    queryKey: qk.projectWork.queue(host),
    queryFn: () => apiJson<ProjectWorkQueueResponse>('/api/staff/v1/work-items/queue'),
    staleTime: WORK_QUEUE_HANDOFF_FRESHNESS_MS,
    gcTime: ONE_DAY,
  });

export function preloadProjectWorkQueue(
  queryClient: Pick<QueryClient, 'prefetchQuery'>,
  router: { prefetch(href: string): void },
  host: string,
): void {
  router.prefetch(PROJECT_WORK_QUEUE_HREF);
  void queryClient.prefetchQuery(projectWorkQueueQueryOptions(host));
}
