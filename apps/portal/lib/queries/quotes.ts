import { queryOptions } from '@tanstack/react-query';
import { getQuoteVersion, listQuoteVersions } from '@/lib/quotes/quotesRepo';
import { qk } from './keys';

const ONE_DAY = 1000 * 60 * 60 * 24;
const TEN_MINUTES = 1000 * 60 * 10;

export const quoteVersionsByProjectQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.quotes.versionsByProject(host, projectId),
    queryFn: () => listQuoteVersions(projectId),
    staleTime: TEN_MINUTES,
    gcTime: ONE_DAY,
  });

export const quoteVersionDetailQueryOptions = (host: string, quoteVersionId: string) =>
  queryOptions({
    queryKey: qk.quotes.detail(host, quoteVersionId),
    queryFn: () => getQuoteVersion(quoteVersionId),
    staleTime: TEN_MINUTES,
    gcTime: ONE_DAY,
  });
