'use client';

import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import ProjectHeader from './ProjectHeader';
import ProjectPageShell from './ProjectPageShell';
import styles from './ProjectPage.module.css';

export default function ProjectPageFrame({
  snapshot,
  host,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  tab,
  onProjectAccessEnding,
}: {
  snapshot: ProjectPageSnapshot;
  host: string;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
  onProjectAccessEnding?: (status: number) => void;
}) {
  return (
    <div
      className={styles.pageFrame}
      data-project-page-frame="true"
      data-project-masthead-sticky="true"
    >
      <div
        className={`${styles.pageFrameMastheadSlot} ${styles.pageFrameMastheadSlotSticky}`}
        data-project-masthead-slot="fixed"
        data-project-masthead-slot-sticky="true"
      >
        <ProjectHeader project={snapshot.project} host={host} tab={tab} />
      </div>

      <div className={styles.pageFrameBody}>
        <ProjectPageShell
          snapshot={snapshot}
          snapshotContentReady={snapshotContentReady}
          snapshotState={snapshotState}
          tab={tab}
          onProjectAccessEnding={onProjectAccessEnding}
        />
      </div>
    </div>
  );
}
