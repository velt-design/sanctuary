import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProjectCurrentDesignCommercialCard from '@/components/projects/ProjectPage/tabs/overview/ProjectCurrentDesignCommercialCard';
import {
  COMMAND_CENTRE_FIXTURE_SCENARIOS,
  commandCentreFixtures,
  isCommandCentreFixtureScenario,
} from './fixtures';
import styles from './projectCommandCentreFixture.module.css';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

export default async function ProjectCommandCentreFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  if (!arePortalQaFixturesEnabled()) notFound();
  const requested = (await searchParams).scenario?.trim() ?? '';
  const scenario = isCommandCentreFixtureScenario(requested) ? requested : 'standard-estimate';

  return (
    <main className={styles.page} data-portal-qa-fixture="project-command-centre" data-fixture-scenario={scenario}>
      <header className={styles.header}>
        <p>Fixture-safe Project Overview</p>
        <h1>Command centre Stage 1</h1>
        <nav aria-label="Command centre fixture scenarios">
          {COMMAND_CENTRE_FIXTURE_SCENARIOS.map((item) => (
            <Link
              key={item}
              aria-current={item === scenario ? 'page' : undefined}
              href={`/qa/project-command-centre-fixture?scenario=${item}`}
            >
              {item.replaceAll('-', ' ')}
            </Link>
          ))}
        </nav>
      </header>
      <ProjectCurrentDesignCommercialCard data={commandCentreFixtures[scenario]} />
    </main>
  );
}
