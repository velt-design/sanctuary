import { notFound } from 'next/navigation';
import ProjectsIndexMutationFixtureClient from './ProjectsIndexMutationFixtureClient';
import ProjectDetailsMutationFixtureClient from './ProjectDetailsMutationFixtureClient';
import styles from './projectsIndexMutationFixture.module.css';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

export default function ProjectsIndexMutationFixturePage() {
  if (!arePortalQaFixturesEnabled()) {
    notFound();
  }

  return (
    <main className={styles.page} data-portal-qa-fixture="projects-index-mutation">
      <div className={styles.stack}>
        <ProjectsIndexMutationFixtureClient />
        <ProjectDetailsMutationFixtureClient />
      </div>
    </main>
  );
}
