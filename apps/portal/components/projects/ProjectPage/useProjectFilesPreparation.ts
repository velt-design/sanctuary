'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { prepareProjectFiles } from '@/lib/projects/sharePointFiles/query';
import { discardProjectPreviews, reconcileFolderPreviews, setPreviewOwner } from './tabs/overview/projectFilePreviewOwner';
import { filesNavigationKey, readFilesNavigation } from './tabs/overview/projectFilesNavigation';

export function useProjectFilesPreparation(projectId: string, host: string, enabled: boolean) {
  const client = useQueryClient();
  const { user, role, status } = usePortalSession();
  const ownerId = user?.id;
  useEffect(() => {
    const owner = status === 'authenticated' && ownerId && (role === 'staff' || role === 'admin') ? JSON.stringify([host, ownerId]) : null;
    setPreviewOwner(client, owner);
    if (!enabled && owner) discardProjectPreviews(client, owner, projectId);
  }, [client, enabled, host, ownerId, projectId, role, status]);
  useEffect(() => {
    if (!enabled || status !== 'authenticated' || !ownerId || (role !== 'staff' && role !== 'admin')) return;
    void import('./tabs/FilesTab').catch(() => undefined);
    void import('./tabs/QuotePdfInlinePreview').then(module => module.preloadQuotePdfPreview()).catch(() => undefined);
    const controller = new AbortController();
    const owner = JSON.stringify([host, ownerId]);
    let preparation: typeof import('./tabs/overview/projectFilePreviewPreparation') | undefined;
    let loading: Promise<typeof preparation> | undefined;
    const loadPreparation = () => loading ??= import('./tabs/overview/projectFilePreviewPreparation').then(module => {
      if (controller.signal.aborted) return;
      preparation = module;
      return module;
    }).catch(() => {
      // Metadata stays usable; a later scheduled pass can retry code preparation.
      loading = undefined;
      return undefined;
    });
    const prepare = (renew = false) => {
      const saved = readFilesNavigation(filesNavigationKey(host, ownerId, projectId));
      if (saved.source === 'website') return;
      const ready = loadPreparation();
      void prepareProjectFiles(client, host, ownerId, projectId, saved.rootId, saved.trail.at(-1)?.id, controller.signal, (page, updatedAt) => {
        if (!controller.signal.aborted && page.state === 'ready' && page.rootId && page.folderId) {
          reconcileFolderPreviews(client, owner, projectId, page.rootId, page.folderId, page.items, !page.cursor, updatedAt);
          const rootItem = page.roots.find(root => root.id === page.rootId)?.itemId;
          const folder = { owner, projectId, rootId: page.rootId, folderId: page.folderId };
          void ready.then(module => {
            if (!controller.signal.aborted) module?.prepareFolderPreviews(client, folder, page.items, saved.selectedId, renew, page.folderId === rootItem ? 16 : 8);
          });
        }
      }, renew);
    };
    prepare();
    const interval = setInterval(() => prepare(true), 4 * 60_000);
    return () => { controller.abort(); clearInterval(interval); preparation?.cancelProjectPreviewPreparation(client, owner, projectId); void client.cancelQueries({ queryKey: ['project-sharepoint-files', host, ownerId, projectId] }); };
  }, [client, enabled, host, ownerId, projectId, role, status]);
}
