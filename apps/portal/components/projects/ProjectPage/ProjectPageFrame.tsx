'use client';

import { useEffect, useRef } from 'react';
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
  const frameRef = useRef<HTMLDivElement | null>(null);
  const mastheadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const masthead = mastheadRef.current;
    if (!frame || !masthead || typeof ResizeObserver === 'undefined') return;
    const update = () => frame.style.setProperty('--project-page-masthead-height', `${Math.ceil(masthead.getBoundingClientRect().height)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(masthead);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      className={styles.pageFrame}
      data-project-page-frame="true"
      data-project-masthead-sticky="true"
    >
      <div
        ref={mastheadRef}
        className={`${styles.pageFrameMastheadSlot} ${styles.pageFrameMastheadSlotSticky}`}
        data-project-masthead-slot="fixed"
        data-project-masthead-slot-sticky="true"
      >
        <ProjectHeader project={snapshot.project} host={host} tab={tab} />
      </div>

      <div className={styles.pageFrameBody}>
        <ProjectPageShell
          snapshot={snapshot}
          host={host}
          snapshotContentReady={snapshotContentReady}
          snapshotState={snapshotState}
          tab={tab}
          onProjectAccessEnding={onProjectAccessEnding}
        />
      </div>
    </div>
  );
}
