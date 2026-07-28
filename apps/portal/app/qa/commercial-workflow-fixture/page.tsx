import Link from 'next/link';
import { notFound } from 'next/navigation';
import CommercialWorkflowFixtureClient, {
  type CommercialWorkflowFixtureScenario,
} from './CommercialWorkflowFixtureClient';
import styles from './commercialWorkflowFixture.module.css';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

function parseScenario(value: string | undefined): CommercialWorkflowFixtureScenario {
  return value === 'needs-attention' ? 'needs-attention' : 'retryable';
}

export default async function CommercialWorkflowFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; modal?: string }>;
}) {
  if (!arePortalQaFixturesEnabled()) notFound();
  const params = await searchParams;
  const scenario = parseScenario(params.scenario);
  const initialModalOpen = params.modal !== '0';

  return (
    <main
      className={styles.page}
      data-portal-qa-fixture="commercial-workflow"
      data-fixture-scenario={scenario}
    >
      <header className={styles.header}>
        <div>
          <p>Fixture-safe commercial recovery</p>
          <h1>Prepared quote delivery</h1>
        </div>
        <nav aria-label="Commercial workflow fixture scenarios">
          <Link
            aria-current={scenario === 'retryable' ? 'page' : undefined}
            href="/qa/commercial-workflow-fixture?scenario=retryable&modal=1"
          >
            Retry available
          </Link>
          <Link
            aria-current={scenario === 'needs-attention' ? 'page' : undefined}
            href="/qa/commercial-workflow-fixture?scenario=needs-attention&modal=1"
          >
            Staff attention
          </Link>
        </nav>
      </header>
      <p className={styles.note}>
        No database, provider, email or customer record is used by this fixture.
      </p>
      <CommercialWorkflowFixtureClient
        key={`${scenario}-${initialModalOpen ? 'open' : 'closed'}`}
        scenario={scenario}
        initialModalOpen={initialModalOpen}
      />
    </main>
  );
}
