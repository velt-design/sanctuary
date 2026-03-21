'use client';

import type { ProjectPageSnapshot } from '@/lib/projects/types';
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
  tab,
}: {
  snapshot: ProjectPageSnapshot;
  tab: string;
}) {
  const { containerRef, createHandlePointerDownHandler, displayMode, isDesktopLayout, isResizing, restoreLastOpenMode } =
    useProjectHeaderLayout();
  const stageLabel = PIPELINE_STAGE_LABELS[snapshot.pipeline.stage] ?? String(snapshot.pipeline.stage);

  return (
    <div
      ref={containerRef}
      className={cx(styles.pageFrame, isResizing && styles.pageFrameResizing)}
      data-project-page-frame="true"
      data-project-masthead-mode={displayMode}
    >
      {displayMode === 'collapsed' ? (
        <button
          type="button"
          className={styles.mastheadCollapsedStrip}
          aria-expanded="false"
          data-project-masthead-collapsed="true"
          onClick={restoreLastOpenMode}
        >
          <span className={styles.mastheadCollapsedMain}>
            <span className={styles.mastheadCollapsedTitle}>{snapshot.project.name}</span>
            <span className={styles.mastheadStagePill}>{stageLabel}</span>
          </span>
          <span className={styles.mastheadCollapsedChevron} aria-hidden="true" />
        </button>
      ) : (
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
      )}

      {isDesktopLayout ? (
        <div
          className={styles.mastheadResizeHandle}
          aria-hidden="true"
          data-project-masthead-handle="true"
          onPointerDown={createHandlePointerDownHandler()}
        />
      ) : null}

      <div className={cx(styles.pageFrameBody, isDesktopLayout && styles.pageFrameBodyDesktop)}>
        <ProjectPageShell snapshot={snapshot} tab={tab} />
      </div>
    </div>
  );
}
