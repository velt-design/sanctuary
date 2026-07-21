import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProjectCurrentDesignCommercialCard from '@/components/projects/ProjectPage/tabs/overview/ProjectCurrentDesignCommercialCard';
import ProjectCommandCentreFixtureClient from './ProjectCommandCentreFixtureClient';
import {
  COMMAND_CENTRE_ACTION_SCENARIOS,
  COMMAND_CENTRE_FIXTURE_SCENARIOS,
  commandCentreActionFixtures,
  commandCentreFixtureStaff,
  commandCentreFixtures,
  isCommandCentreActionFixtureScenario,
  isCommandCentreFixtureScenario,
} from './fixtures';
import styles from './projectCommandCentreFixture.module.css';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

export default async function ProjectCommandCentreFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; action?: string }>;
}) {
  if (!arePortalQaFixturesEnabled()) notFound();
  const params = await searchParams;
  const requested = params.scenario?.trim() ?? '';
  const scenario = isCommandCentreFixtureScenario(requested) ? requested : 'standard-estimate';
  const requestedAction = params.action?.trim() ?? '';
  const actionScenario = isCommandCentreActionFixtureScenario(requestedAction) ? requestedAction : 'primary';

  return (
    <main className={styles.page} data-portal-qa-fixture="project-command-centre" data-fixture-scenario={scenario} data-action-scenario={actionScenario}>
      <header className={styles.header}>
        <p>Fixture-safe Project Overview</p>
        <h1>Command centre Stage 2</h1>
        <nav aria-label="Command centre fixture scenarios">
          {COMMAND_CENTRE_FIXTURE_SCENARIOS.map((item) => (
            <Link
              key={item}
              aria-current={item === scenario ? 'page' : undefined}
              href={`/qa/project-command-centre-fixture?scenario=${item}&action=${actionScenario}`}
            >
              {item.replaceAll('-', ' ')}
            </Link>
          ))}
        </nav>
        <nav aria-label="Primary-action fixture scenarios">
          {COMMAND_CENTRE_ACTION_SCENARIOS.map((item) => (
            <Link key={item} aria-current={item === actionScenario ? 'page' : undefined} href={`/qa/project-command-centre-fixture?scenario=${scenario}&action=${item}`}>
              {item}
            </Link>
          ))}
        </nav>
      </header>
      <div className={styles.commandGrid}>
        <ProjectCurrentDesignCommercialCard data={commandCentreFixtures[scenario]} />
        <ProjectCommandCentreFixtureClient operations={commandCentreActionFixtures[actionScenario]} staff={commandCentreFixtureStaff} />
      </div>
    </main>
  );
}
