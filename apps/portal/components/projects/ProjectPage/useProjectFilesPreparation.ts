'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { prepareProjectFiles } from '@/lib/projects/sharePointFiles/query';
import { discardProjectPreviews, setPreviewOwner } from './tabs/overview/projectFilePreviewCache';
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
    const saved = readFilesNavigation(filesNavigationKey(host, ownerId, projectId));
    if (saved.source === 'website') return;
    void import('./tabs/FilesTab').catch(() => undefined);
    void import('./tabs/QuotePdfInlinePreview').then(module => module.preloadQuotePdfPreview()).catch(() => undefined);
    const controller = new AbortController();
    void prepareProjectFiles(client, host, ownerId, projectId, saved.rootId, saved.trail.at(-1)?.id, controller.signal);
    return () => { controller.abort(); void client.cancelQueries({ queryKey: ['project-sharepoint-files', host, ownerId, projectId] }); };
  }, [client, enabled, host, ownerId, projectId, role, status]);
}
