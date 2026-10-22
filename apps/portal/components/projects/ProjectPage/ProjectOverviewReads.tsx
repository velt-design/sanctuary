'use client';

import { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectWorkInitialRead } from '@/lib/projects/projectWorkInitialRead';
import { projectWorkReadFunction } from './projectWorkInitialRead';
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
export function useProjectOverviewReads(host: string, routeProjectId: string, enabled: boolean, initial?: { read: ProjectWorkInitialRead; ownerId: string | null }) {
  // Raw UUID links and the returned snapshot must share the existing app-ID keys.
  const projectId = overviewProjectId(routeProjectId);
  const client = useQueryClient();
  const commandOptions = projectCommandCentreQueryOptions(host, projectId);
  const paymentKey = qk.invoices.scheduleByProject(host, projectId);
  const commandQuery = useQuery({
    ...commandOptions,
    queryFn: projectWorkReadFunction(client, commandOptions.queryKey, 'command', host, routeProjectId, initial?.ownerId ?? null, commandOptions.queryFn!, initial?.read),
    enabled,
  });
  const paymentQuery = useQuery({
    queryKey: paymentKey,
    queryFn: projectWorkReadFunction(client, paymentKey, 'payment', host, routeProjectId, initial?.ownerId ?? null, () => loadProjectInvoiceSchedule(projectId), initial?.read),
    enabled,
  });
  useEffect(() => {
    if (enabled) void preloadProjectOverviewModule().catch(() => undefined);
  }, [enabled]);
  return { host, projectId, commandQuery, paymentQuery };
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
