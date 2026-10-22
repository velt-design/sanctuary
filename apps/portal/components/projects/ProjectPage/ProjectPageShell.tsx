'use client';

import type { ReactNode } from 'react';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import type { ProjectTabKey } from '@/lib/projects/projectTabs';
import ProjectMainTabs from './ProjectMainTabs';
import styles from './ProjectPage.module.css';

export default function ProjectPageShell({
  snapshot,
  projectId = snapshot?.project.id ?? "",
  host,
  readOnly = false,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  tab,
  calculatorWorkspace = false,
  optimisticTab,
  onTabSelect,
  onProjectAccessEnding,
  statusPanel,
}: {
  snapshot: ProjectPageSnapshot | null;
  projectId?: string;
  host: string;
  readOnly?: boolean;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
  calculatorWorkspace?: boolean;
  optimisticTab?: ProjectTabKey | null;
  onTabSelect?: (tab: ProjectTabKey) => void;
  onProjectAccessEnding?: (status: number) => void;
  statusPanel?: ReactNode;
}) {
  return (
    <section className={styles.fullWidthShell} data-project-page-shell="true">
      <ProjectMainTabs
        snapshot={snapshot}
        projectId={projectId}
        host={host}
        readOnly={readOnly}
        snapshotContentReady={snapshotContentReady}
        snapshotState={snapshotState}
        tab={tab}
        calculatorWorkspace={calculatorWorkspace}
        optimisticTab={optimisticTab}
        onTabSelect={onTabSelect}
        onProjectAccessEnding={onProjectAccessEnding}
        statusPanel={statusPanel}
      />
    </section>
  );
}
