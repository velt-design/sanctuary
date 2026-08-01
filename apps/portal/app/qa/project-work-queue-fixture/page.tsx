import { notFound } from 'next/navigation';
import ProjectWorkQueueList from '@/components/projects/workQueue/ProjectWorkQueueList';
import { PageLayout } from '@/components/ui/foundation';
import {
  workQueueFixtureEntries,
  workQueueFixtureStaff,
} from './fixtures';
import FixtureHydrationMarker from './FixtureHydrationMarker';
import styles from './projectWorkQueueFixture.module.css';
import InactiveEnquiryReviewFixture from './InactiveEnquiryReviewFixture';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

export default function ProjectWorkQueueFixturePage() {
  if (!arePortalQaFixturesEnabled()) notFound();

  return (
    <PageLayout
      width="full"
      density="compact"
      className={styles.page}
      data-portal-qa-fixture="project-work-queue"
    >
      <FixtureHydrationMarker />
      <header className={styles.header}>
        <span className={styles.eyebrow}>Fixture-safe project operations</span>
        <h1>Work Queue</h1>
        <p>One current, server-shaped obligation per synthetic project.</p>
      </header>
      <p className={styles.fixtureNote}>
        Synthetic data only. The fixture does not load customer records or run project commands.
      </p>
      <InactiveEnquiryReviewFixture />
      <ProjectWorkQueueList
        entries={workQueueFixtureEntries}
        staff={workQueueFixtureStaff}
        host="fixture.invalid"
      />
    </PageLayout>
  );
}
