import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from "@/lib/projects/types";
import type { ProjectNavigationTabKey } from "@/lib/projects/projectTabs";
import ProjectTabNavigation from "./ProjectTabNavigation";
import ProjectHeaderActions from "./ProjectHeaderActions";
import ProjectHeaderOwnerControl from "./ProjectHeaderOwnerControl";
import StaffPageHeader from "@/components/layout/StaffPageHeader";
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
  optimisticTab?: ProjectNavigationTabKey | null;
  onTabSelect?: (tab: ProjectNavigationTabKey) => void;
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
            <ProjectHeaderOwnerControl
              project={project}
              projectId={projectId}
              pending={metadataPending}
              host={host}
              active={tab === "activity"}
              expectedWorkModel={workModel}
              externallyPaused={readOnly || ownerControlsPaused}
            />
          }
          right={<ProjectHeaderActions project={project} projectId={projectId} disabled={readOnly} />}
        />
      </div>
      <div data-project-header-row="tabs">
        <ProjectTabNavigation
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
