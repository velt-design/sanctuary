'use client';

import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import ProjectMainTabs from './ProjectMainTabs';
import styles from './ProjectPage.module.css';

export default function ProjectPageShell({
  snapshot,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  tab,
  onProjectAccessEnding,
}: {
  snapshot: ProjectPageSnapshot;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
  onProjectAccessEnding?: (status: number) => void;
}) {
  return (
    <section className={styles.fullWidthShell} data-project-page-shell="true">
      <ProjectMainTabs
        snapshot={snapshot}
        snapshotContentReady={snapshotContentReady}
        snapshotState={snapshotState}
        tab={tab}
        onProjectAccessEnding={onProjectAccessEnding}
      />
    </section>
  );
}
