import type { ProjectPageSnapshot } from '@/lib/projects/types';
import ProjectTabNavigation from './ProjectTabNavigation';
import ProjectHeaderActions from './ProjectHeaderActions';
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
    <section className={styles.masthead} aria-label="Project summary">
      <div className={styles.mastheadIdentity}>
        <h1 className={styles.mastheadTitle}>{project.name}</h1>
        <div className={styles.mastheadOwners} aria-label="Project owner">
          <span className={styles.mastheadOwner} data-project-owner={project.owner?.key ?? 'unassigned'}>
            <strong>Owner</strong>
            <span>{project.owner?.displayName ?? 'Unassigned'}</span>
          </span>
        </div>
      </div>

      <ProjectTabNavigation hasJobPacks={Boolean(project.hasJobPacks)} host={host} initialTab={tab} projectId={project.id} />
      <ProjectHeaderActions project={project} />
    </section>
  );
}
