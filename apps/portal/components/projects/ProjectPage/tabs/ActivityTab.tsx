'use client';

import type { ProjectPageSnapshot } from '@/lib/projects/types';
import ProjectTasksSidebarClient from '../ProjectTasksSidebar.client';
import ProjectActivityDesignSnapshotBar from './_components/ProjectActivityDesignSnapshotBar';
import ProjectNotesPanel from './_components/ProjectNotesPanel.client';
import styles from './ActivityTab.module.css';

export default function ActivityTab({ snapshot }: { snapshot: ProjectPageSnapshot }) {
  return (
    <div className={styles.container}>
      <ProjectActivityDesignSnapshotBar projectId={snapshot.project.id} />
      <div className={styles.layout} data-project-activity-tab="true">
        <div className={styles.column} data-activity-column="tasks">
          <h2 className={styles.columnHeader}>Tasks</h2>
          <ProjectTasksSidebarClient projectId={snapshot.project.id} tasks={snapshot.tasks} />
        </div>
        <div className={styles.column} data-activity-column="notes">
          <h2 className={styles.columnHeader}>Notes</h2>
          <ProjectNotesPanel projectId={snapshot.project.id} initialNotes={snapshot.notes} />
        </div>
      </div>
    </div>
  );
}
