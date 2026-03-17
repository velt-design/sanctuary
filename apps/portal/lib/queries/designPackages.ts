import { queryOptions } from '@tanstack/react-query';
import { fetchDesignPackages } from '@/lib/repo/designPackagesRepo';
import { qk } from './keys';

const ONE_DAY = 1000 * 60 * 60 * 24;
const TWO_MINUTES = 1000 * 60 * 2;

export const designPackagesQueryOptions = (host: string) =>
  queryOptions({
    queryKey: qk.designPackages.list(host),
    queryFn: fetchDesignPackages,
    staleTime: TWO_MINUTES,
    gcTime: ONE_DAY,
  });
