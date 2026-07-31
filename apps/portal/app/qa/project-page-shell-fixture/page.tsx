import { notFound } from 'next/navigation';
import ProjectPageFrame from '@/components/projects/ProjectPage/ProjectPageFrame';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import { coerceProjectTab } from '@/lib/projects/projectTabs';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import FixtureLocalFirstBoundary from '../projects-index-mutation-fixture/FixtureLocalFirstBoundary';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

const v2Snapshot: ProjectPageSnapshot = {
  workModel: 'v2',
  project: {
    id: 'proj_fixture_shell',
    name: 'Alexandra Montgomery and Christopher Williamson - North Harbour outdoor living project',
    stage: 'sent',
    contactId: 'contact_fixture',
    contactName: 'Alexandra Montgomery and Christopher Williamson',
    contactEmail: 'aroha@example.invalid',
    contactPhone: '021 555 0100',
    siteAddress: 'Apartment 14, 1847 Great North Road, Point Chevalier, Auckland',
    region: 'Auckland',
    quoteRef: 'Q-2042',
    hasJobPacks: true,
    owner: { key: 'jordan', displayName: 'Jordan' },
  },
  pipeline: { stage: 'sent' },
  activity: [],
  emails: [],
  notes: [],
};

export default async function ProjectPageShellFixture({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; model?: string }>;
}) {
  if (!arePortalQaFixturesEnabled()) notFound();
  const params = await searchParams;
  const snapshot = v2Snapshot;
  const tab = coerceProjectTab(params.tab, snapshot.project.hasJobPacks ?? false);

  return (
    <main
      className={styles.page}
      data-portal-qa-fixture="project-page-shell"
      data-project-work-fixture-model={snapshot.workModel}
    >
      <FixtureLocalFirstBoundary>
        <ProjectPageFrame snapshot={snapshot} host="fixture" snapshotContentReady snapshotState="fresh" tab={tab} />
      </FixtureLocalFirstBoundary>
    </main>
  );
}
