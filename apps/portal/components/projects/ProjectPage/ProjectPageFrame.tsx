"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { ProjectTabKey } from "@/lib/projects/projectTabs";
import type {
  ProjectPageSnapshot,
  ProjectSnapshotLoadState,
} from "@/lib/projects/types";
import ProjectHeader from "./ProjectHeader";
import ProjectPageShell from "./ProjectPageShell";
import styles from "./ProjectPage.module.css";
import { currentProjectWork } from "@/lib/projects/projectCurrentStatus";
import { overviewProjectId, useOptionalProjectOverviewReads } from "./ProjectOverviewReads";
import { ProjectCommercialProvider } from './ProjectCommercialContext';

export default function ProjectPageFrame({
  snapshot,
  projectId: routeProjectId = snapshot?.project.id ?? "",
  host,
  readOnly = false,
  snapshotContentReady = true,
  snapshotState = "fresh",
  tab,
  calculatorWorkspace = false,
  onProjectAccessEnding,
  optimisticTab,
  onTabSelect,
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
  onProjectAccessEnding?: (status: number) => void;
  optimisticTab: ProjectTabKey | null;
  onTabSelect: (tab: ProjectTabKey) => void;
  statusPanel?: ReactNode;
}) {
  const projectId = snapshot?.project.id ?? overviewProjectId(routeProjectId);
  const overviewReads = useOptionalProjectOverviewReads(host, projectId);
  const projectWork = snapshot ? currentProjectWork(snapshot, overviewReads?.commandQuery.data) : undefined;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const mastheadRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const frame = frameRef.current;
    const masthead = mastheadRef.current;
    if (!frame || !masthead || typeof ResizeObserver === "undefined") return;
    const update = () =>
      frame.style.setProperty(
        "--project-page-masthead-height",
        `${Math.ceil(masthead.getBoundingClientRect().height)}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(masthead);
    return () => observer.disconnect();
  }, [calculatorWorkspace]);

  return (
    <div
      ref={frameRef}
      className={`${styles.pageFrame} ${calculatorWorkspace ? styles.pageFrameCalculatorWorkspace : ""}`}
      data-project-page-frame="true"
      data-project-masthead-sticky={calculatorWorkspace ? undefined : "true"}
      data-project-calculator-workspace={calculatorWorkspace ? "true" : undefined}
    >
      {!calculatorWorkspace ? (
        <div
          ref={mastheadRef}
          className={`${styles.pageFrameMastheadSlot} ${styles.pageFrameMastheadSlotSticky}`}
          data-project-masthead-slot="fixed"
          data-project-masthead-slot-sticky="true"
        >
          <ProjectHeader
            project={snapshot?.project ?? null}
            projectId={projectId}
            workModel={snapshot?.workModel}
            projectWork={projectWork}
            snapshotState={snapshotState}
            host={host}
            readOnly={readOnly}
            tab={tab}
            ownerControlsPaused={snapshotState !== "fresh"}
            tabAvailabilityReady={snapshotContentReady}
            optimisticTab={optimisticTab}
            onTabSelect={onTabSelect}
          />
        </div>
      ) : null}

      <div className={styles.pageFrameBody}>
        <ProjectCommercialProvider projectId={projectId} work={projectWork} ready={!readOnly && Boolean(snapshot) && snapshotState === 'fresh' && snapshotContentReady && (snapshot?.workModel === 'legacy' || Boolean(projectWork))}>
        <ProjectPageShell
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
        </ProjectCommercialProvider>
      </div>
    </div>
  );
}
