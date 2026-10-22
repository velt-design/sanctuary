'use client';

import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { fetchProjectFiles } from '@/lib/projects/sharePointFiles/client';
import type { ProjectFilesPage } from '@/lib/projects/sharePointFiles/types';
import { emptyFilesNavigation, filesNavigationKey, readFilesNavigation, writeFilesNavigation, type FilesNavigation } from './projectFilesNavigation';

const FRESH_MS = 30_000;
const BATCH_PAGES = 3;
export function useProjectFilesExplorer(projectId: string, host: string, ownerId: string | null, enabled: boolean) {
  const client = useQueryClient();
  const storageKey = filesNavigationKey(host, ownerId, projectId);
  const [navigation, setNavigation] = useState(emptyFilesNavigation);
  const [hydrated, setHydrated] = useState(false);
  const currentNav = useRef(navigation);
  currentNav.current = navigation;
  const [scan, setScan] = useState<{ key: string; running: boolean }>({ key: '', running: false });
  const scanNonce = useRef(0);
  const automaticScan = useRef('');
  useEffect(() => { const saved = readFilesNavigation(storageKey); currentNav.current = saved; setNavigation(saved); setHydrated(true); }, [storageKey]);
  useEffect(() => {
    if (!storageKey) return;
    const restore = (event: PopStateEvent) => {
      const entry = event.state?.projectFilesNavigation;
      if (entry?.key !== storageKey || !Array.isArray(entry.value?.trail)) return;
      scanNonce.current++; automaticScan.current = ''; setScan({ key: '', running: false });
      writeFilesNavigation(storageKey, entry.value);
      const saved = readFilesNavigation(storageKey); currentNav.current = saved; setNavigation(saved);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [storageKey]);
  const update = (fn: (value: FilesNavigation) => FilesNavigation) => {
    const next = fn(currentNav.current); currentNav.current = next; writeFilesNavigation(storageKey, next); setNavigation(next);
  };
  const folderId = navigation.trail.at(-1)?.id;
  const prefix = ['project-sharepoint-files', host, ownerId, projectId] as const;
  const keyFor = (root: string | undefined, folder: string | undefined) => [...prefix, root ?? 'default', folder ?? 'root'] as const;
  const options = (folder: string | undefined) => ({
    queryKey: keyFor(navigation.rootId, folder), initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) => fetchProjectFiles(projectId, { rootId: navigation.rootId, folderId: folder, cursor: pageParam }, signal),
    getNextPageParam: (page: ProjectFilesPage) => page.state === 'ready' ? page.cursor ?? undefined : undefined,
    enabled: enabled && hydrated && navigation.source === 'sharepoint', staleTime: FRESH_MS, gcTime: 5 * 60_000, retry: false,
  });
  // The same key at root deliberately shares one request/observer cache. No default/explicit-root refetch.
  const roots = useInfiniteQuery(options(undefined));
  const query = useInfiniteQuery(options(folderId));
  const first = query.data?.pages[0];
  const rootPage = roots.data?.pages[0];
  useEffect(() => {
    const data = roots.data;
    const rootId = data?.pages[0]?.rootId;
    if (navigation.rootId || !rootId || !data) return;
    client.setQueryData<InfiniteData<ProjectFilesPage>>(keyFor(rootId, undefined), data, { updatedAt: roots.dataUpdatedAt });
    update(value => ({ ...value, rootId }));
    // Root normalisation runs only when the first default-root response resolves.
  }, [navigation.rootId, roots.data, roots.dataUpdatedAt]);
  const scope = `${navigation.rootId ?? 'default'}:${folderId ?? 'root'}`;
  const activeScope = useRef(scope); activeScope.current = scope;
  const batchKey = `${scope}:${navigation.term}`;
  const allItems = [...new Map((query.data?.pages.flatMap(p => p.items) ?? []).map(item => [item.id, item])).values()];
  const rootFolders = [...new Map((roots.data?.pages.flatMap(p => p.items) ?? []).filter(x => x.kind === 'folder').map(x => [x.id, x])).values()];
  const pages = query.data?.pages.length ?? 0;
  useEffect(() => {
    if (!pages || query.isError) return;
    const count = currentNav.current.pageCounts[scope] ?? 0;
    if (pages > count) update(value => ({ ...value, pageCounts: { ...value.pageCounts, [scope]: pages } }));
  }, [pages, scope, query.isError]);
  async function loadBatch(limit = BATCH_PAGES) {
    if (scan.running || query.isFetching || !query.hasNextPage) return;
    const nonce = ++scanNonce.current;
    setScan({ key: batchKey, running: true });
    try {
      for (let count = 0; count < limit; count++) {
        const next = await query.fetchNextPage({ cancelRefetch: false });
        if (nonce !== scanNonce.current || activeScope.current !== scope || currentNav.current.term !== navigation.term || next.isError || !next.hasNextPage) break;
      }
    } finally { if (nonce === scanNonce.current) setScan({ key: batchKey, running: false }); }
  }
  useEffect(() => {
    if (!first || query.isFetching || !query.hasNextPage || query.isError) return;
    const wanted = Math.min(currentNav.current.pageCounts[scope] ?? 1, 10);
    const token = `${batchKey}:${navigation.term ? 'find' : 'restore'}`;
    if (automaticScan.current === token || (!navigation.term.trim() && pages >= wanted)) return;
    const timer = setTimeout(() => {
      automaticScan.current = token;
      void loadBatch(navigation.term.trim() ? BATCH_PAGES : Math.max(0, wanted - pages));
    }, navigation.term.trim() ? 250 : 0);
    return () => clearTimeout(timer);
    // A bounded pass per folder/term, then explicit continuation; never a whole-project crawl.
  }, [batchKey, first, pages, query.isFetching, query.hasNextPage, query.isError]);
  useEffect(() => () => { scanNonce.current++; }, []);
  const navigate = (trail: FilesNavigation['trail'], rootId = navigation.rootId) => {
    scanNonce.current++; setScan({ key: '', running: false }); automaticScan.current = '';
    if (storageKey) window.history.replaceState({ ...window.history.state, projectFilesNavigation: { key: storageKey, value: currentNav.current } }, '', window.location.href);
    update(value => ({ ...value, rootId, trail, selectedId: undefined, term: '', source: 'sharepoint' }));
    if (storageKey) window.history.pushState({ ...window.history.state, projectFilesNavigation: { key: storageKey, value: currentNav.current } }, '', window.location.href);
  };
  return { navigation, update, navigate, hydrated, query, roots, first, rootPage, allItems, rootFolders, scope,
    scanning: scan.key === batchKey && scan.running, loadBatch,
    find: (term: string) => { scanNonce.current++; setScan({ key: '', running: false }); automaticScan.current = ''; update(value => ({ ...value, term })); },
    refresh: () => { automaticScan.current = ''; void query.refetch(); if (folderId) void roots.refetch(); } };
}
