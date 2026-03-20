import { queryOptions } from '@tanstack/react-query';
import { listGeneratedJobPacks } from '@/lib/repo/jobPacksRepo';
import { qk } from './keys';

const ONE_DAY = 1000 * 60 * 60 * 24;
const TEN_MINUTES = 1000 * 60 * 10;

export const generatedJobPacksByProjectQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.jobPacks.list(host, projectId),
    queryFn: () => listGeneratedJobPacks(projectId),
    staleTime: TEN_MINUTES,
    gcTime: ONE_DAY,
  });
