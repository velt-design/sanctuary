'use client';

import ProjectDetailsSidebarClient from '@/components/projects/ProjectPage/ProjectDetailsSidebar.client';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import styles from './projectsIndexMutationFixture.module.css';

const FIXTURE_PROJECT: ProjectPageSnapshot['project'] = {
  id: 'fixture-project',
  name: 'Fixture Detail Project',
  stage: 'new',
  contactId: 'fixture-contact',
  contactName: 'Fixture Contact',
  contactEmail: 'fixture@example.invalid',
  contactPhone: '000 000 0000',
  siteAddress: '1 Fixture Lane',
  region: 'Fixture Region',
  quoteRef: 'FIXTURE-1',
  nextActionDate: '2026-07-20',
};

export default function ProjectDetailsMutationFixtureClient() {
  return (
    <section className={styles.card} data-project-details-mutation-fixture="ready">
      <p className={styles.eyebrow}>Local-first detail check</p>
      <h2 className={styles.heading}>Project details in the background</h2>
      <p className={styles.explanation}>
        This sample mounts the production user-owned queue, retry state, and project-details editor.
      </p>
      <ProjectDetailsSidebarClient project={FIXTURE_PROJECT} />
    </section>
  );
}
