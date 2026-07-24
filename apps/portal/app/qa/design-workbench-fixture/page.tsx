import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import DesignWorkbenchFixtureClient from '@/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchFixtureClient';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { isSanctuaryGeometryWorkbenchFixturesEnabled } from '@/lib/drawings/workbenchFlags';

type SearchParams = { [key: string]: string | string[] | undefined };

const FIXTURE_PROJECT_NAME = 'Sanctuary Fixture Project';
const FIXTURE_BACK_HREF = '/staff/projects/fixture-roof';

function resolveQueryParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function renderInvalidFixtureLines(fixtureSlug: string): string[] {
  return [
    'This hidden internal route can mount baked Sanctuary Geometry Workbench fixtures for QA.',
    'Route state: Invalid Fixture',
    `Unknown fixture slug: ${fixtureSlug}`,
  ];
}

export default async function DesignWorkbenchFixturePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  if (!isSanctuaryGeometryWorkbenchFixturesEnabled()) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const fixtureSlug = resolveQueryParam(resolvedSearchParams?.fixture);

  if (!fixtureSlug) {
    notFound();
  }

  const fixture = getSanctuaryGeometryWorkbenchFixture(fixtureSlug);

  if (!fixture) {
    return (
      <main
        className={styles.page}
        data-project-id="fixture-roof"
        data-workbench-context="invalid_fixture"
        data-workbench-fixture={fixtureSlug}
      >
        <section className={styles.surface}>
          <div className={styles.surfaceInner}>
            <h1 className={styles.title}>Design Workbench</h1>
            <p className={styles.subtitle}>{FIXTURE_PROJECT_NAME}</p>
            {renderInvalidFixtureLines(fixtureSlug).map((line) => (
              <p key={line} className={styles.subtitle}>
                {line}
              </p>
            ))}
            <Link href={FIXTURE_BACK_HREF} className={styles.backLink}>
              Back to Project
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      className={styles.page}
      data-project-id="fixture-roof"
      data-workbench-context="fixture_ready"
      data-workbench-fixture={fixture.slug}
    >
      <section className={styles.surface}>
        <div className={styles.surfaceInner}>
          <DesignWorkbenchFixtureClient
            fixture={fixture}
            projectName={FIXTURE_PROJECT_NAME}
            siteAddress={null}
            backHref={FIXTURE_BACK_HREF}
          />
        </div>
      </section>
    </main>
  );
}
