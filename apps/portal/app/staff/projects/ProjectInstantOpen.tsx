'use client';

import { useCallback } from 'react';
import { projectDetailHref } from '@/lib/queries/projectOpenPreload';
import { useProjectInstantNavigation } from './ProjectInstantNavigation';
import ProjectSnapshotPageClient from './[projectId]/ProjectSnapshotPageClient';

export function useProjectInstantOpen(): {
  openProject: (projectId: string) => void;
} {
  const { showProject } = useProjectInstantNavigation();

  const openProject = useCallback((nextProjectId: string) => {
    const href = projectDetailHref(nextProjectId);
    showProject(
      href,
      <ProjectSnapshotPageClient
        projectId={nextProjectId}
        tab="activity"
        estimateId={null}
        debugExportEnabled={false}
      />,
    );
  }, [showProject]);

  return { openProject };
}
