'use client';

import ProjectTasksSidebarClient from '@/components/projects/ProjectPage/ProjectTasksSidebar.client';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import styles from './projectsIndexMutationFixture.module.css';

const FIXTURE_TASKS: ProjectPageSnapshot['tasks'] = {
  stage: 'scheduled',
  items: [
    {
      key: 'order_materials',
      label: 'Order materials',
      kind: 'manual',
      isDone: false,
      isManualDone: false,
    },
    {
      key: 'roofing_ordered',
      label: 'Roofing ordered',
      kind: 'manual',
      isDone: false,
      isManualDone: false,
    },
  ],
};

export default function ProjectTaskMutationFixtureClient() {
  return (
    <section className={styles.card} data-project-task-mutation-fixture="ready">
      <p className={styles.eyebrow}>Optimistic task check</p>
      <h2 className={styles.heading}>Project tasks in the background</h2>
      <p className={styles.explanation}>
        This sample uses the production task toggle, precise rollback, and explicit retry path.
      </p>
      <ProjectTasksSidebarClient projectId="fixture-project" tasks={FIXTURE_TASKS} />
    </section>
  );
}
