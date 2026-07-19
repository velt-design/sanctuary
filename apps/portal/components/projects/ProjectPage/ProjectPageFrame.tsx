'use client';

import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { PIPELINE_STAGE_LABELS } from '@/lib/projects/pipelineDefinition';
import ProjectHeader from './ProjectHeader';
import ProjectPageShell from './ProjectPageShell';
import ProjectPipelineBar from './ProjectPipelineBar';
import { useProjectHeaderLayout } from './useProjectHeaderLayout';
import styles from './ProjectPage.module.css';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export default function ProjectPageFrame({
  snapshot,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  tab,
}: {
  snapshot: ProjectPageSnapshot;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
}) {
  const {
    containerRef,
    createHandleClickHandler,
    createHandleKeyDownHandler,
    createHandlePointerDownHandler,
    displayMode,
    isDesktopLayout,
    isResizing,
  } = useProjectHeaderLayout();
  const isCollapsed = displayMode === 'collapsed';
  const isStickyMasthead = isDesktopLayout && (displayMode === 'compact' || displayMode === 'collapsed');
  const handleClassName = cx(styles.mastheadResizeHandle, isCollapsed && styles.mastheadResizeHandleCollapsed);

  return (
    <div
      ref={containerRef}
      className={cx(styles.pageFrame, isResizing && styles.pageFrameResizing)}
      data-project-page-frame="true"
      data-project-masthead-mode={displayMode}
      data-project-masthead-sticky={isStickyMasthead ? 'true' : undefined}
    >
      <div
        className={cx(styles.pageFrameMastheadSlot, isStickyMasthead && styles.pageFrameMastheadSlotSticky)}
        data-project-masthead-slot={displayMode}
        data-project-masthead-slot-sticky={isStickyMasthead ? 'true' : undefined}
      >
        {displayMode !== 'collapsed' ? (
          <ProjectHeader
            project={snapshot.project}
            currentStage={snapshot.pipeline.stage}
            mode={displayMode === 'compact' ? 'compact' : 'expanded'}
            pipeline={
              displayMode === 'expanded' ? (
                <ProjectPipelineBar projectId={snapshot.project.id} stage={snapshot.pipeline.stage} compact />
              ) : undefined
            }
          />
        ) : null}

        {isDesktopLayout ? (
          isCollapsed ? (
            <button
              type="button"
              className={handleClassName}
              aria-expanded="false"
              aria-label="Expand project header"
              data-project-masthead-collapsed="true"
              data-project-masthead-handle="true"
              onClick={createHandleClickHandler()}
              onKeyDown={createHandleKeyDownHandler()}
              onPointerDown={createHandlePointerDownHandler()}
            />
          ) : (
            <div
              className={handleClassName}
              aria-hidden="true"
              data-project-masthead-handle="true"
              onPointerDown={createHandlePointerDownHandler()}
            />
          )
        ) : null}
      </div>

      <div className={cx(styles.pageFrameBody, isDesktopLayout && styles.pageFrameBodyDesktop)}>
        <ProjectPageShell
          snapshot={snapshot}
          snapshotContentReady={snapshotContentReady}
          snapshotState={snapshotState}
          tab={tab}
        />
      </div>
    </div>
  );
}
