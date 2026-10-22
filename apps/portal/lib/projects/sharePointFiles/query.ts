import { infiniteQueryOptions, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import type { ProjectFilesPage } from './types';
import { fetchProjectFiles } from './client';

const PROJECT_FILES_FRESH_MS = 5 * 60_000;
export function projectFilesQueryOptions(host: string, ownerId: string | null, projectId: string, rootId?: string, folderId?: string) {
  return infiniteQueryOptions({
    queryKey: ['project-sharepoint-files', host, ownerId, projectId, rootId ?? 'default', folderId ?? 'root'] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => fetchProjectFiles(projectId, { rootId, folderId, cursor: pageParam }, signal),
    getNextPageParam: page => page.state === 'ready' ? page.cursor ?? undefined : undefined,
    staleTime: PROJECT_FILES_FRESH_MS, gcTime: PROJECT_FILES_FRESH_MS, retry: false,
  });
}

export async function prepareProjectFiles(client: QueryClient, host: string, ownerId: string, projectId: string, rootId?: string, folderId?: string, signal?: AbortSignal, onPage?: (page: ProjectFilesPage, updatedAt: number) => void, renew = false) {
  async function prepare(options: ReturnType<typeof projectFilesQueryOptions>) {
    // A scheduled renewal must reach the source before the five-minute lease.
    // Ordinary preparation still reuses fresh data and concurrent reads coalesce.
    const extent = client.getQueryData(options.queryKey)?.pages.length ?? 1;
    await client.prefetchInfiniteQuery({ ...options, staleTime: renew ? 0 : options.staleTime, pages: extent });
    const pages = client.getQueryData(options.queryKey)?.pages, first = pages?.[0];
    if (!signal?.aborted && client.getQueryState(options.queryKey)?.status === 'success' && first) {
      const items = [...new Map(pages!.flatMap(page => page.items).map(item => [item.id, item])).values()];
      onPage?.({ ...first, items, cursor: pages!.at(-1)!.cursor }, client.getQueryState(options.queryKey)?.dataUpdatedAt ?? 0);
    }
  }
  // Only this project's root, saved folder and first two root folders. New
  // queries prepare one page; revalidation preserves the already loaded extent.
  const rootOptions = projectFilesQueryOptions(host, ownerId, projectId, rootId);
  const rootPreparation = prepare(rootOptions).then(async () => {
    if (client.getQueryState(rootOptions.queryKey)?.status !== 'success') return;
    const page = client.getQueryData(rootOptions.queryKey)?.pages[0];
    if (signal?.aborted || page?.state !== 'ready' || !page.rootId) return;
    const preparedRootId = page.rootId;
    // Normalise the same authorized default-root result without another source read.
    const explicitKey = projectFilesQueryOptions(host, ownerId, projectId, preparedRootId).queryKey;
    const prepared = client.getQueryData(rootOptions.queryKey), existing = client.getQueryData<InfiniteData<ProjectFilesPage>>(explicitKey);
    if (!rootId && (existing?.pages.length ?? 0) <= (prepared?.pages.length ?? 0) && (client.getQueryState(explicitKey)?.dataUpdatedAt ?? 0) <= (client.getQueryState(rootOptions.queryKey)?.dataUpdatedAt ?? 0)) client.setQueryData<InfiniteData<ProjectFilesPage>>(explicitKey, prepared, { updatedAt: client.getQueryState(rootOptions.queryKey)?.dataUpdatedAt });
    const likely = page.items.filter(item => item.kind === 'folder' && item.id !== folderId).slice(0, 2);
    await Promise.all(likely.map(item => prepare(projectFilesQueryOptions(host, ownerId, projectId, preparedRootId, item.id))));
  });
  await Promise.all([rootPreparation, folderId ? prepare(projectFilesQueryOptions(host, ownerId, projectId, rootId, folderId)) : Promise.resolve()]);
}
