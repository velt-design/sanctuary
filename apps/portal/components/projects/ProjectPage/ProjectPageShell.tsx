'use client';

import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import type { ProjectNavigationTabKey } from '@/lib/projects/projectTabs';
import ProjectMainTabs from './ProjectMainTabs';
import styles from './ProjectPage.module.css';

export default function ProjectPageShell({
  snapshot,
  host,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  tab,
  optimisticTab,
  onProjectAccessEnding,
}: {
  snapshot: ProjectPageSnapshot;
  host: string;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
  optimisticTab?: ProjectNavigationTabKey | null;
  onProjectAccessEnding?: (status: number) => void;
}) {
  return (
    <section className={styles.fullWidthShell} data-project-page-shell="true">
      <ProjectMainTabs
        snapshot={snapshot}
        host={host}
        snapshotContentReady={snapshotContentReady}
        snapshotState={snapshotState}
        tab={tab}
        optimisticTab={optimisticTab}
        onProjectAccessEnding={onProjectAccessEnding}
      />
    </section>
  );
}
