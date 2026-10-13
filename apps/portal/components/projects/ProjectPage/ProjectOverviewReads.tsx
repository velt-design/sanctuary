'use client';

import { createContext, useContext, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectCommandCentreQueryOptions } from '@/lib/queries/projects';
import { qk } from '@/lib/queries/keys';
import { loadProjectInvoiceSchedule } from '@/lib/repo/invoicesRepo';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { preloadProjectOverviewModule } from './projectTabModules';

function overviewProjectId(projectId: string): string {
  try {
    return appIdFromUuid('proj', uuidFromAppId(projectId, 'proj').toLowerCase());
  } catch {
    // Synthetic/local IDs retain their existing identity; the API validates access.
    return projectId;
  }
}

/** One active observer per read, started before project metadata or lazy UI arrives. */
export function useProjectOverviewReads(host: string, routeProjectId: string, enabled: boolean) {
  // Raw UUID links and the returned snapshot must share the existing app-ID keys.
  const projectId = overviewProjectId(routeProjectId);
  const commandQuery = useQuery({
    ...projectCommandCentreQueryOptions(host, projectId),
    enabled,
  });
  const paymentQuery = useQuery({
    queryKey: qk.invoices.scheduleByProject(host, projectId),
    queryFn: () => loadProjectInvoiceSchedule(projectId),
    enabled,
  });
  useEffect(() => {
    if (enabled) void preloadProjectOverviewModule().catch(() => undefined);
  }, [enabled]);
  return { host, projectId, commandQuery, paymentQuery };
}

const ProjectOverviewReadsContext = createContext<ReturnType<typeof useProjectOverviewReads> | null>(null);
export const ProjectOverviewReadsProvider = ProjectOverviewReadsContext.Provider;

export function useActiveProjectOverviewReads(host: string, projectId: string) {
  const reads = useContext(ProjectOverviewReadsContext);
  if (!reads || reads.host !== host || reads.projectId !== overviewProjectId(projectId)) {
    throw new Error('Overview reads must belong to the active project route');
  }
  return reads;
}
