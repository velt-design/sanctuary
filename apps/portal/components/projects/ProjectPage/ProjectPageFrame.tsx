"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { coerceProjectTab, type ProjectNavigationTabKey } from "@/lib/projects/projectTabs";
import type {
  ProjectPageSnapshot,
  ProjectSnapshotLoadState,
} from "@/lib/projects/types";
import ProjectHeader from "./ProjectHeader";
import ProjectPageShell from "./ProjectPageShell";
import styles from "./ProjectPage.module.css";

export default function ProjectPageFrame({
  snapshot,
  host,
  snapshotContentReady = true,
  snapshotState = "fresh",
  tab,
  calculatorWorkspace = false,
  onProjectAccessEnding,
}: {
  snapshot: ProjectPageSnapshot;
  host: string;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
  calculatorWorkspace?: boolean;
  onProjectAccessEnding?: (status: number) => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const mastheadRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const [optimisticTab, setOptimisticTab] =
    useState<ProjectNavigationTabKey | null>(null);
  const canonicalTab = coerceProjectTab(
    searchParams.get("tab") ?? tab,
    Boolean(snapshot.project.hasJobPacks),
  );
  const pendingTabRef = useRef<{
    from: typeof canonicalTab;
    target: ProjectNavigationTabKey;
  } | null>(null);

  useEffect(() => {
    const pending = pendingTabRef.current;
    if (pending) {
      if (canonicalTab === pending.target) {
        pendingTabRef.current = null;
      } else if (canonicalTab === pending.from) {
        return;
      } else {
        pendingTabRef.current = null;
      }
    }
    setOptimisticTab(null);
  }, [canonicalTab]);

  const selectTab = (nextTab: ProjectNavigationTabKey) => {
    pendingTabRef.current = { from: canonicalTab, target: nextTab };
    setOptimisticTab(nextTab);
  };

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
            host={host}
            tab={tab}
            ownerControlsPaused={snapshotState !== "fresh"}
            optimisticTab={optimisticTab}
            onTabSelect={selectTab}
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
