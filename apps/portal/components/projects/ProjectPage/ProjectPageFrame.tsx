"use client";

import { useEffect, useRef } from "react";
import type { ProjectNavigationTabKey } from "@/lib/projects/projectTabs";
import type {
  ProjectPageSnapshot,
  ProjectSnapshotLoadState,
} from "@/lib/projects/types";
import ProjectHeader from "./ProjectHeader";
import ProjectPageShell from "./ProjectPageShell";
import styles from "./ProjectPage.module.css";
import { currentProjectWork } from "@/lib/projects/projectCurrentStatus";
import { useOptionalProjectOverviewReads } from "./ProjectOverviewReads";

export default function ProjectPageFrame({
  snapshot,
  host,
  snapshotContentReady = true,
  snapshotState = "fresh",
  tab,
  calculatorWorkspace = false,
  onProjectAccessEnding,
  optimisticTab,
  onTabSelect,
}: {
  snapshot: ProjectPageSnapshot;
  host: string;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
  calculatorWorkspace?: boolean;
  onProjectAccessEnding?: (status: number) => void;
  optimisticTab: ProjectNavigationTabKey | null;
  onTabSelect: (tab: ProjectNavigationTabKey) => void;
}) {
  const overviewReads = useOptionalProjectOverviewReads(host, snapshot.project.id);
  const projectWork = currentProjectWork(snapshot, overviewReads?.commandQuery.data);
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
            project={snapshot.project}
            workModel={snapshot.workModel}
            projectWork={projectWork}
            snapshotState={snapshotState}
            host={host}
            tab={tab}
            ownerControlsPaused={snapshotState !== "fresh"}
            tabAvailabilityReady={snapshotContentReady}
            optimisticTab={optimisticTab}
            onTabSelect={onTabSelect}
          />
        </div>
      ) : null}

      <div className={styles.pageFrameBody}>
        <ProjectPageShell
          snapshot={snapshot}
          host={host}
          snapshotContentReady={snapshotContentReady}
          snapshotState={snapshotState}
          tab={tab}
          calculatorWorkspace={calculatorWorkspace}
          optimisticTab={optimisticTab}
          onProjectAccessEnding={onProjectAccessEnding}
        />
      </div>
    </div>
  );
}
