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
  workModel,
  projectWork,
  snapshotState = "fresh",
  host,
  tab,
  ownerControlsPaused,
  tabAvailabilityReady = true,
  optimisticTab,
  onTabSelect,
}: {
  project: ProjectPageSnapshot["project"];
  workModel: ProjectPageSnapshot["workModel"];
  projectWork?: ProjectPageSnapshot["projectWork"];
  snapshotState?: ProjectSnapshotLoadState;
  host: string;
  tab: string;
  ownerControlsPaused?: boolean;
  tabAvailabilityReady?: boolean;
  optimisticTab?: ProjectNavigationTabKey | null;
  onTabSelect?: (tab: ProjectNavigationTabKey) => void;
}) {
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
          title={project.name}
          subtitle={<>{project.contactName || 'Customer not recorded'} · {projectLocation(project)}</>}
          titleAccessory={
            <ProjectCurrentStatusBadge
              stage={project.stage}
              facts={workModel === 'legacy' && tabAvailabilityReady
                ? { workModel, effectiveState: null, closedOutcome: null }
                : projectWork ? { workModel, effectiveState: projectWork.effectiveState, closedOutcome: projectWork.closedOutcome } : null}
              pending={snapshotState === 'summary' || snapshotState === 'pending'}
              saved={snapshotState === 'refresh-failed'}
            />
          }
          meta={
            <ProjectHeaderOwnerControl
              project={project}
              host={host}
              active={tab === "activity"}
              expectedWorkModel={workModel}
              externallyPaused={ownerControlsPaused}
            />
          }
          right={<ProjectHeaderActions project={project} />}
        />
      </div>
      <div data-project-header-row="tabs">
        <ProjectTabNavigation
          hasJobPacks={Boolean(project.hasJobPacks)}
          tabAvailabilityReady={tabAvailabilityReady}
          host={host}
          initialTab={tab}
          projectId={project.id}
          optimisticTab={optimisticTab}
          onTabSelect={onTabSelect}
        />
      </div>
    </Card>
  );
}
