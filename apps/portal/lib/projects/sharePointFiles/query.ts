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

export async function prepareProjectFiles(client: QueryClient, host: string, ownerId: string, projectId: string, rootId?: string, folderId?: string, signal?: AbortSignal) {
  // Only this project's root, saved folder and first two root folders. The bound
  // covers an ordinary first folder visit without traversing the tree or polling.
  const rootOptions = projectFilesQueryOptions(host, ownerId, projectId, rootId);
  const rootPreparation = client.prefetchInfiniteQuery({ ...rootOptions, pages: 1 }).then(async () => {
    if (client.getQueryState(rootOptions.queryKey)?.status !== 'success') return;
    const page = client.getQueryData(rootOptions.queryKey)?.pages[0];
    if (signal?.aborted || page?.state !== 'ready' || !page.rootId) return;
    const preparedRootId = page.rootId;
    // Normalise the same authorized default-root result without another source read.
    if (!rootId) client.setQueryData<InfiniteData<ProjectFilesPage>>(projectFilesQueryOptions(host, ownerId, projectId, preparedRootId).queryKey, client.getQueryData<InfiniteData<ProjectFilesPage>>(rootOptions.queryKey), { updatedAt: client.getQueryState(rootOptions.queryKey)?.dataUpdatedAt });
    const likely = page.items.filter(item => item.kind === 'folder' && item.id !== folderId).slice(0, 2);
    await Promise.all(likely.map(item => client.prefetchInfiniteQuery({ ...projectFilesQueryOptions(host, ownerId, projectId, preparedRootId, item.id), pages: 1 })));
  });
  await Promise.all([rootPreparation, folderId ? client.prefetchInfiniteQuery({ ...projectFilesQueryOptions(host, ownerId, projectId, rootId, folderId), pages: 1 }) : Promise.resolve()]);
}
