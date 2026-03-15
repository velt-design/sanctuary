import { queryOptions } from '@tanstack/react-query';
import { fetchRunningJobs } from '@/lib/repo/runningJobsRepo';
import { qk } from './keys';

const ONE_DAY = 1000 * 60 * 60 * 24;
const TWO_MINUTES = 1000 * 60 * 2;

export const runningJobsQueryOptions = (host: string) =>
  queryOptions({
    queryKey: qk.runningJobs.list(host),
    queryFn: fetchRunningJobs,
    staleTime: TWO_MINUTES,
    gcTime: ONE_DAY,
  });
