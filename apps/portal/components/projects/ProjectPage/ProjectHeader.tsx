import type { ProjectPageSnapshot } from '@/lib/projects/types';
import type { ProjectNavigationTabKey } from '@/lib/projects/projectTabs';
import ProjectTabNavigation from './ProjectTabNavigation';
import ProjectHeaderActions from './ProjectHeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { Card, ProjectStageBadge } from '@/components/ui/foundation';
import styles from './ProjectPage.module.css';

export default function ProjectHeader({
  project,
  host,
  tab,
  optimisticTab,
  onTabSelect,
}: {
  project: ProjectPageSnapshot['project'];
  host: string;
  tab: string;
  optimisticTab?: ProjectNavigationTabKey | null;
  onTabSelect?: (tab: ProjectNavigationTabKey) => void;
}) {
  return (
    <Card className={styles.masthead} padding="none" aria-label="Project summary" data-ui-foundation="true">
      <div className={styles.mastheadBody} data-project-header-row="command">
        <StaffPageHeader
          className={styles.mastheadHeader}
          variant="detail"
          title={project.name}
          titleAccessory={<ProjectStageBadge stage={project.stage} compact />}
          meta={<span className={styles.mastheadOwner} data-project-owner={project.owner?.key ?? 'unassigned'}><strong>Owner</strong><span>{project.owner?.displayName ?? 'Unassigned'}</span></span>}
          right={<ProjectHeaderActions project={project} />}
        />
      </div>
      <div data-project-header-row="tabs">
        <ProjectTabNavigation
          hasJobPacks={Boolean(project.hasJobPacks)}
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
