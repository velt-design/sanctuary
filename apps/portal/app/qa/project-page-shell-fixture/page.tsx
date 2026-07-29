import { notFound } from 'next/navigation';
import ProjectPageFrame from '@/components/projects/ProjectPage/ProjectPageFrame';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import { coerceProjectTab } from '@/lib/projects/projectTabs';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import FixtureLocalFirstBoundary from '../projects-index-mutation-fixture/FixtureLocalFirstBoundary';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

const snapshot: ProjectPageSnapshot = {
  workModel: 'legacy',
  project: {
    id: 'proj_fixture_shell',
    name: 'Aroha Smith - Takapuna',
    stage: 'sent',
    contactId: 'contact_fixture',
    contactName: 'Aroha Smith',
    contactEmail: 'aroha@example.invalid',
    contactPhone: '021 555 0100',
    siteAddress: '10 Example Road, Takapuna',
    region: 'Auckland',
    quoteRef: 'Q-2042',
    hasJobPacks: true,
    owner: { key: 'jordan', displayName: 'Jordan' },
  },
  pipeline: { stage: 'sent' },
  tasks: { stage: 'sent', items: [] },
  activity: [],
  emails: [],
  notes: [],
};

export default async function ProjectPageShellFixture({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!arePortalQaFixturesEnabled()) notFound();
  const params = await searchParams;
  const tab = coerceProjectTab(params.tab, snapshot.project.hasJobPacks ?? false);

  return (
    <main className={styles.page} data-portal-qa-fixture="project-page-shell">
      <FixtureLocalFirstBoundary>
        <ProjectPageFrame snapshot={snapshot} host="fixture" snapshotContentReady snapshotState="fresh" tab={tab} />
      </FixtureLocalFirstBoundary>
    </main>
  );
}
