import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from "@/lib/projects/types";
import type { ProjectTabKey } from "@/lib/projects/projectTabs";
import ProjectTabNavigation from "./ProjectTabNavigationSurface";
import ProjectHeaderActions from "./ProjectHeaderActionsSurface";
import type { ReactNode } from "react";
import StaffPageHeader from "@/components/layout/StaffPageHeaderSurface";
import GlobalPortalSearchSurface, { type SearchReadOwner } from "@/components/layout/GlobalPortalSearchSurface";
import ProjectHeaderOwnerSurface from './ProjectHeaderOwnerSurface';
import { Card } from "@/components/ui/foundation/FoundationSurfaces";
import ProjectCurrentStatusBadge from "../ProjectCurrentStatusBadge";
import styles from "./ProjectPage.module.css";
import { projectLocation } from '@/lib/projects/projectLocation';

export default function ProjectHeaderSurface({
  project,
  projectId = project?.id ?? "",
  workModel,
  projectWork,
  snapshotState = "fresh",
  host,
  readOnly = false,
  tab,
  tabAvailabilityReady = true,
  optimisticTab,
  onTabSelect,
  privateContentReady = true,
  searchReader,
  ownerControl, privateActions, onTabIntent, deferHistory, search, actions,
}: {
  project: ProjectPageSnapshot["project"] | null;
  projectId?: string;
  workModel?: ProjectPageSnapshot["workModel"];
  projectWork?: ProjectPageSnapshot["projectWork"];
  snapshotState?: ProjectSnapshotLoadState;
  host: string;
  readOnly?: boolean;
  tab: string;
  ownerControlsPaused?: boolean;
  tabAvailabilityReady?: boolean;
  optimisticTab?: ProjectTabKey | null;
  onTabSelect?: (tab: ProjectTabKey) => void;
  privateContentReady?: boolean;
  searchReader?: { component: SearchReadOwner } | null;
  deferHistory?: boolean;
  search?: ReactNode; actions?: ReactNode;
  ownerControl?: ReactNode; privateActions?: ReactNode; onTabIntent?: (tab: import("@/lib/projects/projectTabs").ProjectNavigationTabKey) => void;
}) {
  const metadataPending = snapshotState === "pending" || snapshotState === "summary";
  return (
    <Card
      className={styles.masthead}
      padding="none"
      aria-label="Project summary"
      data-ui-foundation="true"
    >
      <div className={styles.mastheadBody} data-project-header-row="command">
        <StaffPageHeader
          search={search ?? <GlobalPortalSearchSurface registration={searchReader ?? null} />}
          className={styles.mastheadHeader}
          variant="detail"
          title={project?.name ?? (metadataPending ? "Reading project" : "Project unavailable")}
          subtitle={project ? <>{project.contactName || 'Customer not recorded'} · {projectLocation(project)}</> : metadataPending ? 'Reading project details' : 'Project details unavailable'}
          titleAccessory={
            <ProjectCurrentStatusBadge
              stage={project?.stage}
              facts={workModel === 'legacy' && tabAvailabilityReady
                ? { workModel, effectiveState: null, closedOutcome: null }
                : projectWork && workModel ? { workModel, effectiveState: projectWork.effectiveState, closedOutcome: projectWork.closedOutcome } : null}
              pending={metadataPending}
              saved={Boolean(project) && snapshotState === 'refresh-failed'}
            />
          }
          meta={
            ownerControl ?? <ProjectHeaderOwnerSurface pending={metadataPending} />
          }
          right={actions ?? <ProjectHeaderActions project={project} projectId={projectId} disabled={readOnly} privateContentReady={privateContentReady} privateActions={privateActions} />}
        />
      </div>
      <div data-project-header-row="tabs">
        <ProjectTabNavigation
          onIntent={onTabIntent}
          deferHistory={deferHistory}
          hasJobPacks={Boolean(project?.hasJobPacks)}
          tabAvailabilityReady={tabAvailabilityReady}
          host={host}
          initialTab={tab}
          projectId={projectId}
          optimisticTab={optimisticTab}
          onTabSelect={onTabSelect}
        />
      </div>
    </Card>
  );
}
