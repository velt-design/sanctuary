"use client";

import type { ReactNode } from "react";
import type { ProjectTabKey } from "@/lib/projects/projectTabs";
import type {
  ProjectPageSnapshot,
  ProjectSnapshotLoadState,
} from "@/lib/projects/types";
import ProjectHeader from "./ProjectHeader";
import ProjectPageShell from "./ProjectPageShell";
import ProjectPageFrameSurface from "./ProjectPageFrameSurface";
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
  privateContentReady = true,
  searchReader,
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
  privateContentReady?: boolean;
  searchReader?: { component: import("@/components/layout/GlobalPortalSearchSurface").SearchReadOwner } | null;
}) {
  const projectId = snapshot?.project.id ?? overviewProjectId(routeProjectId);
  const overviewReads = useOptionalProjectOverviewReads(host, projectId);
  const projectWork = snapshot ? currentProjectWork(snapshot, overviewReads?.commandQuery.data) : undefined;
  return <ProjectPageFrameSurface projectId={projectId} selectedTab={optimisticTab??undefined} calculatorWorkspace={calculatorWorkspace} header={<ProjectHeader
            privateContentReady={privateContentReady}
            searchReader={searchReader}
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
            statusPanel={statusPanel}
          />}>
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
          privateContentReady={privateContentReady}
        />
        </ProjectCommercialProvider>
  </ProjectPageFrameSurface>;
}
