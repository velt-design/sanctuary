'use client';

import { useCallback } from 'react';
import { projectDetailHref } from '@/lib/queries/projectOpenPreload';
import { useProjectInstantNavigation } from './ProjectInstantNavigation';

export function useProjectInstantOpen(): {
  openProject: (projectId: string) => void;
} {
  const { showProject } = useProjectInstantNavigation();

  const openProject = useCallback((nextProjectId: string) => {
    const href = projectDetailHref(nextProjectId);
    showProject(href);
  }, [showProject]);

  return { openProject };
}
