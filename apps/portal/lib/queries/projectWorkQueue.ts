import { queryOptions } from '@tanstack/react-query';
import { apiJson } from '@/lib/repo/apiClient';
import type { ProjectWorkQueueEntry } from '@/lib/projects/workItems/types';
import { qk } from './keys';

export type ProjectWorkQueueResponse = {
  entries: ProjectWorkQueueEntry[];
  generatedAt: string;
};

const ONE_MINUTE = 60_000;
const ONE_DAY = 24 * 60 * 60 * 1_000;

export const projectWorkQueueQueryOptions = (host: string) =>
  queryOptions({
    queryKey: qk.projectWork.queue(host),
    queryFn: () => apiJson<ProjectWorkQueueResponse>('/api/staff/v1/work-items/queue'),
    staleTime: ONE_MINUTE,
    gcTime: ONE_DAY,
  });
