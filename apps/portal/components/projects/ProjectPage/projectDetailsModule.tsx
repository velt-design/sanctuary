'use client';

import dynamic from 'next/dynamic';
import styles from './ProjectPage.module.css';

const loadProjectDetails = () => import('./ProjectDetailsSidebar');

function ProjectDetailsLoadingState() {
  return (
    <div className={styles.tabLoadingState} data-project-details-loading="true" role="status">
      Loading project details in the background...
    </div>
  );
}

export const LazyProjectDetailsSidebar = dynamic(loadProjectDetails, {
  loading: ProjectDetailsLoadingState,
});

export async function preloadProjectDetails(): Promise<void> {
  await loadProjectDetails();
}
