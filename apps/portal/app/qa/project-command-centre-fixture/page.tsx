import Link from "next/link";
import { notFound } from "next/navigation";
import ProjectCommandCentreFixtureClient from "./ProjectCommandCentreFixtureClient";
import FixtureLocalFirstBoundary from "../projects-index-mutation-fixture/FixtureLocalFirstBoundary";
import {
  COMMAND_CENTRE_FIXTURE_SCENARIOS,
  COMMAND_CENTRE_VIEW_STATES,
  COMMAND_CENTRE_WORK_SCENARIOS,
  commandCentreFixtures,
  commandCentreWorkFixtures,
  isCommandCentreFixtureScenario,
  isCommandCentreViewFixtureState,
  isCommandCentreWorkFixtureScenario,
} from "./fixtures";
import styles from "./projectCommandCentreFixture.module.css";

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === "1";
}

export default async function ProjectCommandCentreFixturePage({
  searchParams,
}: {
  searchParams: Promise<{
    scenario?: string;
    work?: string;
    state?: string;
  }>;
}) {
  if (!arePortalQaFixturesEnabled()) notFound();
  const params = await searchParams;
  const requestedScenario = params.scenario?.trim() ?? "";
  const scenario = isCommandCentreFixtureScenario(requestedScenario)
    ? requestedScenario
    : "standard-estimate";
  const requestedWork = params.work?.trim() ?? "";
  const work = isCommandCentreWorkFixtureScenario(requestedWork)
    ? requestedWork
    : "v2-primary";
  const requestedState = params.state?.trim() ?? "";
  const state = isCommandCentreViewFixtureState(requestedState)
    ? requestedState
    : "ready";

  const fixtureHref = (
    nextScenario: string,
    nextWork: string,
    nextState: string,
  ) =>
    `/qa/project-command-centre-fixture?scenario=${nextScenario}&work=${nextWork}&state=${nextState}`;

  return (
    <main
      className={styles.page}
      data-portal-qa-fixture="project-command-centre"
      data-fixture-scenario={scenario}
      data-work-scenario={work}
      data-view-state={state}
    >
      <header className={styles.header}>
        <p>Fixture-safe Project Overview</p>
        <h1>Approved Overview V2 composition</h1>
        <nav aria-label="Commercial fixture scenarios">
          {COMMAND_CENTRE_FIXTURE_SCENARIOS.map((item) => (
            <Link
              key={item}
              aria-current={item === scenario ? "page" : undefined}
              href={fixtureHref(item, work, state)}
            >
              {item.replaceAll("-", " ")}
            </Link>
          ))}
        </nav>
        <nav aria-label="Project Work fixture scenarios">
          {COMMAND_CENTRE_WORK_SCENARIOS.map((item) => (
            <Link
              key={item}
              aria-current={item === work ? "page" : undefined}
              href={fixtureHref(scenario, item, state)}
            >
              {item.replaceAll("-", " ")}
            </Link>
          ))}
        </nav>
        <nav aria-label="Overview read-state scenarios">
          {COMMAND_CENTRE_VIEW_STATES.map((item) => (
            <Link
              key={item}
              aria-current={item === state ? "page" : undefined}
              href={fixtureHref(scenario, work, item)}
            >
              {item.replaceAll("-", " ")}
            </Link>
          ))}
        </nav>
      </header>
      <FixtureLocalFirstBoundary>
        <ProjectCommandCentreFixtureClient
          currentDesign={commandCentreFixtures[scenario]}
          work={commandCentreWorkFixtures[work]}
          viewState={state}
        />
      </FixtureLocalFirstBoundary>
    </main>
  );
}
