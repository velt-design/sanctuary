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
        <div className={`${styles.column} ${styles.activityColumn}`} data-activity-column="activity">
          <h2 className={styles.columnHeader}>Activity</h2>
          <ProjectNotesPanel projectId={snapshot.project.id} initialNotes={snapshot.notes} />
        </div>
        <div className={`${styles.column} ${styles.tasksColumn}`} data-activity-column="tasks">
          <h2 className={styles.columnHeader}>Tasks</h2>
          <ProjectTasksSidebarClient projectId={snapshot.project.id} tasks={snapshot.tasks} />
        </div>
      </div>
    </div>
  );
}
