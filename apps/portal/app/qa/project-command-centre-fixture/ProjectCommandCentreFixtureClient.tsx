'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import ProjectPrimaryActionCard from '@/components/projects/ProjectPage/tabs/overview/ProjectPrimaryActionCard';
import { qk } from '@/lib/queries/keys';
import type { ProjectCommandCentreOperations, ProjectCommandStaffSummary } from '@/lib/projects/commandCentre/types';

export default function ProjectCommandCentreFixtureClient({
  operations,
  staff,
}: {
  operations: ProjectCommandCentreOperations;
  staff: ProjectCommandStaffSummary[];
}) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const projectId = 'proj_fixture';
  const host = 'fixture';
  const state = useQuery({
    queryKey: qk.projects.commandCentre(host, projectId),
    queryFn: async () => ({ operations }),
    initialData: { operations },
    enabled: false,
  });
  return (
    <div data-command-centre-fixture-hydrated={hydrated ? 'true' : 'false'}>
      <ProjectPrimaryActionCard
        projectId={projectId}
        host={host}
        operations={state.data.operations}
        stale={false}
        onRefresh={() => undefined}
        initialStaff={staff}
      />
    </div>
  );
}
