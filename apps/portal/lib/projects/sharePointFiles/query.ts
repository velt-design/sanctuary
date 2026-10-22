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

export async function prepareProjectFiles(client: QueryClient, host: string, ownerId: string, projectId: string, rootId?: string, folderId?: string, signal?: AbortSignal, onPage?: (page: ProjectFilesPage, updatedAt: number) => void) {
  async function prepare(options: ReturnType<typeof projectFilesQueryOptions>) {
    await client.prefetchInfiniteQuery({ ...options, pages: 1 });
    const page = client.getQueryData(options.queryKey)?.pages[0];
    if (!signal?.aborted && client.getQueryState(options.queryKey)?.status === 'success' && page) onPage?.(page, client.getQueryState(options.queryKey)?.dataUpdatedAt ?? 0);
  }
  // Only this project's root, saved folder and first two root folders. The bound
  // covers an ordinary first folder visit without traversing the tree or polling.
  const rootOptions = projectFilesQueryOptions(host, ownerId, projectId, rootId);
  const rootPreparation = prepare(rootOptions).then(async () => {
    if (client.getQueryState(rootOptions.queryKey)?.status !== 'success') return;
    const page = client.getQueryData(rootOptions.queryKey)?.pages[0];
    if (signal?.aborted || page?.state !== 'ready' || !page.rootId) return;
    const preparedRootId = page.rootId;
    // Normalise the same authorized default-root result without another source read.
    const explicitKey = projectFilesQueryOptions(host, ownerId, projectId, preparedRootId).queryKey;
    if (!rootId && (client.getQueryState(explicitKey)?.dataUpdatedAt ?? 0) <= (client.getQueryState(rootOptions.queryKey)?.dataUpdatedAt ?? 0)) client.setQueryData<InfiniteData<ProjectFilesPage>>(explicitKey, client.getQueryData<InfiniteData<ProjectFilesPage>>(rootOptions.queryKey), { updatedAt: client.getQueryState(rootOptions.queryKey)?.dataUpdatedAt });
    const likely = page.items.filter(item => item.kind === 'folder' && item.id !== folderId).slice(0, 2);
    await Promise.all(likely.map(item => prepare(projectFilesQueryOptions(host, ownerId, projectId, preparedRootId, item.id))));
  });
  await Promise.all([rootPreparation, folderId ? prepare(projectFilesQueryOptions(host, ownerId, projectId, rootId, folderId)) : Promise.resolve()]);
}
