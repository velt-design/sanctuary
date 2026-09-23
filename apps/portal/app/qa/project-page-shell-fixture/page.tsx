import { notFound } from 'next/navigation';
import ProjectPageFrame from '@/components/projects/ProjectPage/ProjectPageFrame';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import { coerceProjectTab } from '@/lib/projects/projectTabs';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import FixtureLocalFirstBoundary from '../projects-index-mutation-fixture/FixtureLocalFirstBoundary';
import CommercialClarityBoundary from './CommercialClarityBoundary';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

const v2Snapshot: ProjectPageSnapshot = {
  workModel: 'v2',
  project: {
    id: 'proj_fixture_shell',
    name: 'Sample project - Takapuna outdoor living',
    stage: 'deposit',
    contactId: 'contact_fixture',
    contactName: 'Sample customer',
    contactEmail: 'aroha@example.invalid',
    contactPhone: '021 555 0100',
    siteAddress: 'Synthetic address, Takapuna, Auckland',
    region: 'Auckland',
    quoteRef: 'Q-2042',
    hasJobPacks: true,
    owner: { key: 'jordan', displayName: 'Jordan' },
  },
  pipeline: { stage: 'deposit' },
  activity: [],
  emails: [],
  notes: [],
};

export default async function ProjectPageShellFixture({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    model?: string;
    estimateId?: string;
    fromEstimateId?: string;
    newDesign?: string;
    commercial?: string;
  }>;
}) {
  if (!arePortalQaFixturesEnabled()) notFound();
  const params = await searchParams;
  const snapshot = v2Snapshot;
  const tab = coerceProjectTab(params.tab, snapshot.project.hasJobPacks ?? false);
  const calculatorWorkspace = tab === 'estimates'
    && Boolean(params.estimateId?.trim() || params.fromEstimateId?.trim() || params.newDesign === '1');

  const frame = <ProjectPageFrame
    snapshot={snapshot} host="fixture" snapshotContentReady snapshotState="fresh"
    tab={tab} calculatorWorkspace={calculatorWorkspace}
  />;
  return (
    <main
      className={`${styles.page} ${calculatorWorkspace ? styles.calculatorPageLayout : ''}`}
      style={params.commercial === '1' ? { padding: '24px', maxWidth: '1600px', margin: '0 auto' } : undefined}
      data-portal-qa-fixture="project-page-shell"
      data-project-work-fixture-model={snapshot.workModel}
    >
      {params.commercial === '1' ? <p>Sample project · no live data. Explore Commercial and Job Packs. Server actions are unavailable in this preview.</p> : null}
      <FixtureLocalFirstBoundary>
        {params.commercial === '1' ? <CommercialClarityBoundary>{frame}</CommercialClarityBoundary> : frame}
      </FixtureLocalFirstBoundary>
    </main>
  );
}
