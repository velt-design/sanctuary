import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from "@/lib/projects/types";
import type { ProjectTabKey } from "@/lib/projects/projectTabs";
import ProjectTabNavigation from "./ProjectTabNavigation";
import ProjectHeaderActions from "./ProjectHeaderActions";
import ProjectHeaderOwnerControl from "./ProjectHeaderOwnerControl";
import StaffPageHeader from "@/components/layout/StaffPageHeaderSurface";
import GlobalPortalSearch from "@/components/layout/GlobalPortalSearch.client";
import GlobalPortalSearchSurface, { type SearchReadOwner } from "@/components/layout/GlobalPortalSearchSurface";
import ProjectHeaderOwnerSurface from './ProjectHeaderOwnerSurface';
import { Card } from "@/components/ui/foundation";
import ProjectCurrentStatusBadge from "../ProjectCurrentStatusBadge";
import styles from "./ProjectPage.module.css";
import { projectLocation } from '@/lib/projects/projectLocation';

export default function ProjectHeader({
  project,
  projectId = project?.id ?? "",
  workModel,
  projectWork,
  snapshotState = "fresh",
  host,
  readOnly = false,
  tab,
  ownerControlsPaused,
  tabAvailabilityReady = true,
  optimisticTab,
  onTabSelect,
  privateContentReady = true,
  searchReader,
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
          search={searchReader !== undefined ? <GlobalPortalSearchSurface registration={searchReader} /> : privateContentReady ? <GlobalPortalSearch /> : <GlobalPortalSearchSurface registration={null} />}
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
            privateContentReady ? <ProjectHeaderOwnerControl
              project={project}
              projectId={projectId}
              pending={metadataPending}
              host={host}
              active={tab === "activity"}
              expectedWorkModel={workModel}
              externallyPaused={readOnly || ownerControlsPaused}
            /> : <ProjectHeaderOwnerSurface pending={metadataPending} />
          }
          right={<ProjectHeaderActions project={project} projectId={projectId} disabled={readOnly} privateContentReady={privateContentReady} />}
        />
      </div>
      <div data-project-header-row="tabs">
        <ProjectTabNavigation
          privateContentReady={privateContentReady}
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
