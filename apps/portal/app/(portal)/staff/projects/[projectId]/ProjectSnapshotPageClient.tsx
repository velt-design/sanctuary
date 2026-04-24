'use client';

import ProjectPageFrame from '@/components/projects/ProjectPage/ProjectPageFrame';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import type { ProjectPageSnapshot } from '@/lib/projects/types';

export default function ProjectSnapshotPageClient({
  projectId,
  tab,
  initialSnapshot,
}: {
  projectId: string;
  tab: string;
  initialSnapshot: ProjectPageSnapshot;
}) {
  return (
    <main className={styles.page} data-project-id={projectId}>
      <ProjectPageFrame snapshot={initialSnapshot} tab={tab} />
    </main>
  );
}
