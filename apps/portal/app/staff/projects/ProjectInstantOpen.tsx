'use client';

import dynamic from 'next/dynamic';
import { useCallback } from 'react';
import ProjectDetailLoading from './[projectId]/loading';
import { projectDetailHref } from '@/lib/queries/projectOpenPreload';
import { useProjectInstantNavigation } from './ProjectInstantNavigation';

const loadProjectSnapshotPage = () => import('./[projectId]/ProjectSnapshotPageClient');
const InstantProjectSnapshotPage = dynamic(loadProjectSnapshotPage, {
  loading: () => <ProjectDetailLoading />,
});

export function preloadProjectInstantView(): Promise<unknown> {
  return loadProjectSnapshotPage();
}

export function useProjectInstantOpen(): {
  openProject: (projectId: string) => void;
} {
  const { showProject } = useProjectInstantNavigation();

  const openProject = useCallback((nextProjectId: string) => {
    const href = projectDetailHref(nextProjectId);
    showProject(
      href,
      <InstantProjectSnapshotPage
        projectId={nextProjectId}
        tab="activity"
        estimateId={null}
        debugExportEnabled={false}
      />,
    );
  }, [showProject]);

  return { openProject };
}
