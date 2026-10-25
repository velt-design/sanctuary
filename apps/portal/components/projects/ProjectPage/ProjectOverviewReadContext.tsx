'use client';
import { createContext, useContext } from 'react';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import type { useProjectOverviewReads } from './ProjectOverviewReads';
export function overviewProjectId(projectId: string): string {
  try {
    return appIdFromUuid('proj', uuidFromAppId(projectId, 'proj').toLowerCase());
  } catch {
    // Synthetic/local IDs retain their existing identity; the API validates access.
    return projectId;
  }
}

const ProjectOverviewReadsContext = createContext<ReturnType<typeof useProjectOverviewReads> | null>(null);
export const ProjectOverviewReadsProvider = ProjectOverviewReadsContext.Provider;

/** The shared masthead can reuse Overview's observer without starting another read. */
export function useOptionalProjectOverviewReads(host: string, projectId: string) {
  const reads = useContext(ProjectOverviewReadsContext);
  return reads?.host === host && reads.projectId === overviewProjectId(projectId) ? reads : null;
}

export function useActiveProjectOverviewReads(host: string, projectId: string) {
  const reads = useOptionalProjectOverviewReads(host, projectId);
  if (!reads) {
    throw new Error('Overview reads must belong to the active project route');
  }
  return reads;
}
