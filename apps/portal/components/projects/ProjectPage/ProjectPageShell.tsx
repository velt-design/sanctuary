'use client';

import type { ProjectPageSnapshot } from '@/lib/projects/types';
import ProjectDetailsSidebar from './ProjectDetailsSidebar';
import ProjectTasksSidebar from './ProjectTasksSidebar';
import ProjectMainTabs from './ProjectMainTabs';
import { useProjectViewMode } from '../useProjectViewMode';
import styles from './ProjectPage.module.css';

type ModeKey = 'general' | 'focus';

function coerceMode(value: string | null): ModeKey {
  return value === 'focus' ? 'focus' : 'general';
}

export default function ProjectPageShell({
  snapshot,
  tab,
  mode,
}: {
  snapshot: ProjectPageSnapshot;
  tab: string;
  mode: string;
}) {
  const { mode: activeMode, setMode } = useProjectViewMode(coerceMode(mode));
  const isFocus = activeMode === 'focus';

  return (
    <div className={`${styles.bodyGrid} ${isFocus ? styles.bodyGridFocus : ''}`}>
      <aside className={`${styles.sticky} ${styles.sidebarLeft} ${isFocus ? styles.hidden : ''}`}>
        <ProjectDetailsSidebar project={snapshot.project} />
      </aside>

      <section className={styles.center}>
        <ProjectMainTabs snapshot={snapshot} tab={tab} mode={activeMode} setMode={setMode} />
      </section>

      <aside className={`${styles.sticky} ${styles.sidebarRight} ${isFocus ? styles.hidden : ''}`}>
        <ProjectTasksSidebar projectId={snapshot.project.id} tasks={snapshot.tasks} />
      </aside>
    </div>
  );
}
