import { queryOptions } from '@tanstack/react-query';
import { getQuoteVersion, listQuoteVersions } from '@/lib/quotes/quotesRepo';
import { qk } from './keys';

export const quoteVersionsByProjectQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.quotes.versionsByProject(host, projectId),
    queryFn: () => listQuoteVersions(projectId),
  });

export const quoteVersionDetailQueryOptions = (host: string, quoteVersionId: string) =>
  queryOptions({
    queryKey: qk.quotes.detail(host, quoteVersionId),
    queryFn: () => getQuoteVersion(quoteVersionId),
  });

