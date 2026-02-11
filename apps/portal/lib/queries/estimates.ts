import { queryOptions } from '@tanstack/react-query';
import { qk } from './keys';
import { listEstimates } from '@/lib/repo/estimatesRepo';

export const estimatesByProjectQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.estimates.byProject(host, projectId),
    queryFn: () => listEstimates(projectId),
  });
