import type { ProjectPageSnapshot } from '@/lib/projects/types';
import ProjectTabNavigation from './ProjectTabNavigation';
import ProjectHeaderActions from './ProjectHeaderActions';
import PageHeader from '@/components/layout/PageHeader';
import { ProjectStageBadge, ProjectStageTracker } from '@/components/ui/foundation';
import styles from './ProjectPage.module.css';

export default function ProjectHeader({
  project,
  host,
  tab,
}: {
  project: ProjectPageSnapshot['project'];
  host: string;
  tab: string;
}) {
  return (
    <section className={`${styles.masthead} ${styles.mastheadFoundation}`} aria-label="Project summary" data-ui-foundation="true">
      <PageHeader
        variant="detail"
        title={project.name}
        breadcrumbs={[{ label: 'Projects', href: '/staff/projects' }, { label: project.quoteRef || project.id }]}
        description={project.siteAddress || 'Site address not recorded'}
        meta={<span className={styles.mastheadOwner} data-project-owner={project.owner?.key ?? 'unassigned'}><strong>Owner</strong><span>{project.owner?.displayName ?? 'Unassigned'}</span></span>}
        right={<ProjectHeaderActions project={project} />}
      />
      <div className={styles.mastheadStage}>
        <ProjectStageBadge stage={project.stage} />
        <div className={styles.mastheadTracker}><ProjectStageTracker currentStage={project.stage} /></div>
      </div>
      <ProjectTabNavigation hasJobPacks={Boolean(project.hasJobPacks)} host={host} initialTab={tab} projectId={project.id} />
    </section>
  );
}
