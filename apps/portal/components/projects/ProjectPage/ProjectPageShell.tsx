'use client';

import type { ReactNode } from 'react';
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
  calculatorWorkspace = false,
  optimisticTab,
  onProjectAccessEnding,
  statusPanel,
}: {
  snapshot: ProjectPageSnapshot;
  host: string;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
  calculatorWorkspace?: boolean;
  optimisticTab?: ProjectNavigationTabKey | null;
  onProjectAccessEnding?: (status: number) => void;
  statusPanel?: ReactNode;
}) {
  return (
    <section className={styles.fullWidthShell} data-project-page-shell="true">
      <ProjectMainTabs
        snapshot={snapshot}
        host={host}
        snapshotContentReady={snapshotContentReady}
        snapshotState={snapshotState}
        tab={tab}
        calculatorWorkspace={calculatorWorkspace}
        optimisticTab={optimisticTab}
        onProjectAccessEnding={onProjectAccessEnding}
        statusPanel={statusPanel}
      />
    </section>
  );
}
