'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import ProjectDetailLoading from './[projectId]/loading';
import { projectDetailHref } from '@/lib/queries/projectOpenPreload';

const loadProjectSnapshotPage = () => import('./[projectId]/ProjectSnapshotPageClient');
const InstantProjectSnapshotPage = dynamic(loadProjectSnapshotPage, {
  loading: () => <ProjectDetailLoading />,
});

export function preloadProjectInstantView(): Promise<unknown> {
  return loadProjectSnapshotPage();
}

export function useProjectInstantOpen(): {
  instantProject: ReactNode | null;
  openProject: (projectId: string) => void;
} {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);

  const openProject = useCallback((nextProjectId: string) => {
    const href = projectDetailHref(nextProjectId);
    setProjectId(nextProjectId);
    window.history.pushState(null, '', href);
    router.refresh();
  }, [router]);

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/staff/projects') setProjectId(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return {
    instantProject: projectId ? (
      <InstantProjectSnapshotPage
        projectId={projectId}
        tab="activity"
        estimateId={null}
        debugExportEnabled={false}
      />
    ) : null,
    openProject,
  };
}
