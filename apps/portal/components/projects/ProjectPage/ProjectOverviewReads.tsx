'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectWorkInitialRead, ProjectWorkReadLoaders } from '@/lib/projects/projectWorkInitialRead';
import { projectWorkReadFunction } from './projectWorkInitialRead';
import { projectCommandCentreQueryOptions } from '@/lib/queries/projects';
import { qk } from '@/lib/queries/keys';
import { loadProjectInvoiceSchedule } from '@/lib/repo/invoicesRepo';
import { overviewProjectId } from './ProjectOverviewReadContext';
import { preloadProjectOverviewModule } from './projectTabModules';

/** One active observer per read, started before project metadata or lazy UI arrives. */
export function useProjectOverviewReads(host: string, routeProjectId: string, enabled: boolean, initial?: { read: ProjectWorkInitialRead; ownerId: string | null }, loaders?: Pick<ProjectWorkReadLoaders, 'command' | 'payment'>) {
  // Raw UUID links and the returned snapshot must share the existing app-ID keys.
  const projectId = overviewProjectId(routeProjectId);
  const client = useQueryClient();
  const commandOptions = projectCommandCentreQueryOptions(host, projectId);
  const paymentKey = qk.invoices.scheduleByProject(host, projectId);
  const commandQuery = useQuery({
    ...commandOptions,
    queryFn: projectWorkReadFunction(client, commandOptions.queryKey, 'command', host, routeProjectId, initial?.ownerId ?? null, loaders ? () => loaders.command(routeProjectId) : commandOptions.queryFn!, initial?.read),
    enabled,
  });
  const paymentQuery = useQuery({
    queryKey: paymentKey,
    queryFn: projectWorkReadFunction(client, paymentKey, 'payment', host, routeProjectId, initial?.ownerId ?? null, () => loaders ? loaders.payment(routeProjectId) : loadProjectInvoiceSchedule(projectId), initial?.read),
    enabled,
  });
  useEffect(() => {
    if (enabled) void preloadProjectOverviewModule().catch(() => undefined);
  }, [enabled]);
  return { host, projectId, commandQuery, paymentQuery };
}


export { overviewProjectId, ProjectOverviewReadsProvider, useOptionalProjectOverviewReads, useActiveProjectOverviewReads } from './ProjectOverviewReadContext';
