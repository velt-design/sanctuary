import fs from "node:fs";
import path from "node:path";
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  assertResponsivePortalJourneyHasNoBlockingOverlay,
  assertPortalFinalFrameContinuity,
  beginPortalJourney,
  capturePortalFinalFrame,
  elapsedJourneyMs,
  finishPortalJourney,
  installPortalPerformanceProbe,
  portalPerformanceBuildId,
  waitForBackgroundSettled,
  type PortalFinalFrameCapture,
  type PortalPerformanceJourney,
  type PortalPerformanceRun,
} from "./support/portalPerformance";

type RouteBudget = {
  name: string;
  route: string;
  shellVisibleMsMax: number;
  contentVisibleMsMax: number;
};

type JourneyBudget = {
  name: string;
  feedbackMsMax: number;
  usefulContentMsMax: number;
  liveDataReadyMsMax?: number;
  enforced: boolean;
  aggregation?: "run" | "p75";
  productFeedbackMsMax?: number;
};

type InteractionBudget = JourneyBudget & {
  route: string;
};

type PerfBudgets = {
  productTargets: {
    feedbackMsMax: number;
    warmTabFeedbackMsMax: number;
    cachedContentMsMax: number;
    longestTaskMsMax: number;
  };
  routes: RouteBudget[];
  warmJourneys: JourneyBudget[];
  interactions: InteractionBudget[];
};

const journeys: PortalPerformanceJourney[] = [];
const budgetPath = path.resolve(
  process.cwd(),
  "playwright/portal.performance.budgets.json",
);
const budgets = JSON.parse(fs.readFileSync(budgetPath, "utf8")) as PerfBudgets;

function routeBudget(name: string): RouteBudget {
  const found = budgets.routes.find((entry) => entry.name === name);
  if (!found)
    throw new Error(`Missing cold-route performance budget for ${name}`);
  return found;
}

function warmBudget(name: string): JourneyBudget {
  const found = budgets.warmJourneys.find((entry) => entry.name === name);
  if (!found)
    throw new Error(`Missing warm-navigation performance budget for ${name}`);
  return found;
}

function interactionBudget(name: string): InteractionBudget {
  const found = budgets.interactions.find((entry) => entry.name === name);
  if (!found)
    throw new Error(`Missing interaction performance budget for ${name}`);
  return found;
}

function recordJourney(journey: PortalPerformanceJourney) {
  journeys.push(journey);
  if (journey.kind === "warm-navigation" || journey.kind === "interaction") {
    assertResponsivePortalJourneyHasNoBlockingOverlay(journey);
  }
}

type FinalFrameReady = () => Promise<PortalFinalFrameCapture>;

async function expectNoLayeredRouteLoading(page: Page): Promise<void> {
  await expect(
    page.locator(
      [
        '[aria-label="Page loading"]:visible',
        "[data-portal-instant-shell]:visible",
        '[data-ui-foundation-consumer="blueprint-loading"]:visible',
        '[data-ui-foundation-consumer="projects-pending"]:visible',
        '[data-ui-foundation-consumer="contacts-pending"]:visible',
      ].join(", "),
    ),
  ).toHaveCount(0);
}

async function dashboardFinalFrame(
  page: Page,
): Promise<PortalFinalFrameCapture> {
  const root = page.locator('[data-portal-page-shell="dashboard"]:visible');
  await expect(root.locator('[data-dashboard-hero="true"]')).toBeVisible({
    timeout: 60_000,
  });
  for (const region of [
    "Quick actions",
    "Project portfolio",
    "Work Queue",
    "Recent Activity",
    "Recent Estimates",
    "My Tasks",
  ]) {
    await expect(
      root.getByRole("region", { name: region, exact: true }),
    ).toBeVisible();
  }
  await expectNoLayeredRouteLoading(page);
  return capturePortalFinalFrame(
    root,
    "Dashboard",
    '[data-portal-page-shell="dashboard"]:has([data-dashboard-hero="true"]):has([aria-label="Project portfolio"])',
  );
}

async function projectsFinalFrame(
  page: Page,
): Promise<PortalFinalFrameCapture> {
  const root = page.locator(
    '[data-portal-page-shell="projects"][data-portal-page-shell-ready="true"]:visible',
  );
  await expect(
    root.getByRole("link", { name: "New project", exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    root.getByRole("region", { name: "Filters", exact: true }),
  ).toBeVisible();
  for (const label of ["Journey", "Stage", "State", "Owner", "Sort", "Rows"]) {
    await expect(root.getByLabel(label, { exact: true })).toBeVisible();
  }
  const table = root.getByRole("table", { name: "Projects", exact: true });
  await expect(table).toBeVisible();
  for (const column of [
    "Name",
    "Client",
    "Phone",
    "Address",
    "Journey",
    "Stage",
    "State",
    "Owner",
    "Next attention",
    "Actions",
  ]) {
    await expect(
      table.getByRole("columnheader", { name: column, exact: true }),
    ).toBeVisible();
  }
  await expectNoLayeredRouteLoading(page);
  return capturePortalFinalFrame(
    root,
    "Projects",
    '[data-portal-page-shell="projects"]:has([data-portal-shell-structure="projects-table"]):has([aria-label="Filters"])',
  );
}

async function contactsFinalFrame(
  page: Page,
): Promise<PortalFinalFrameCapture> {
  const root = page.locator("[data-contacts-index-state]:visible");
  await expect(
    root.getByRole("link", { name: "New Contact", exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    root.getByRole("region", { name: "Search contacts", exact: true }),
  ).toBeVisible();
  for (const label of ["Search", "Sort", "Rows per page"]) {
    await expect(root.getByLabel(label, { exact: true })).toBeVisible();
  }
  const list = root.getByRole("region", { name: "Contacts list", exact: true });
  await expect(list).toBeVisible();
  const table = list.getByRole("table");
  await expect(table).toBeVisible();
  for (const column of ["Name", "Email", "Phone", "Created"]) {
    await expect(
      table.getByRole("columnheader", { name: column, exact: true }),
    ).toBeVisible();
  }
  await expectNoLayeredRouteLoading(page);
  return capturePortalFinalFrame(
    root,
    "Contacts",
    '[data-contacts-index-state]:has([aria-label="Search contacts"]):has(table)',
  );
}

async function scheduleFinalFrame(
  page: Page,
): Promise<PortalFinalFrameCapture> {
  const root = page.locator('[data-ui-foundation-consumer="schedule"]:visible');
  await expect(
    root.getByRole("button", {
      name: /Collapse unscheduled panel|Expand unscheduled panel/,
    }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    root.getByRole("region", { name: "Installer lanes", exact: true }),
  ).toBeVisible();
  await expectNoLayeredRouteLoading(page);
  return capturePortalFinalFrame(
    root,
    "Schedule",
    '[data-ui-foundation-consumer="schedule"]:has([aria-label="Installer lanes"])',
  );
}

async function workQueueFinalFrame(
  page: Page,
): Promise<PortalFinalFrameCapture> {
  const root = page.locator("[data-project-work-queue-state]:visible");
  await expect(
    root.getByRole("region", { name: "Work Queue filters", exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  for (const label of ["Owner", "Stage", "When"]) {
    await expect(root.getByLabel(label, { exact: true })).toBeVisible();
  }
  await expectNoLayeredRouteLoading(page);
  return capturePortalFinalFrame(
    root,
    "Work Queue",
    '[data-project-work-queue-state]:has([aria-label="Work Queue filters"])',
  );
}

async function spreadsheetFinalFrame(
  page: Page,
  title: string,
): Promise<PortalFinalFrameCapture> {
  const root = page.locator(
    '[data-ui-foundation-consumer="spreadsheet"]:visible',
  );
  await expect(
    root.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(root.getByRole("table")).toBeVisible();
  await expect(
    root.getByLabel("Sheet zoom controls", { exact: true }),
  ).toBeVisible();
  await expectNoLayeredRouteLoading(page);
  return capturePortalFinalFrame(
    root,
    title,
    '[data-ui-foundation-consumer="spreadsheet"]:has(table):has([aria-label="Sheet zoom controls"])',
  );
}

async function calculatorFinalFrame(
  page: Page,
  workspace: "standalone" | "project",
): Promise<PortalFinalFrameCapture> {
  const root = page.locator(
    `[data-calculator-workspace="${workspace}"]:visible`,
  );
  await expect(root.locator("[data-calculator-command-bar]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    root.locator("[data-calculator-configuration-form]"),
  ).toBeVisible();
  await expect(
    root.locator("[data-calculator-result-inspector]"),
  ).toBeVisible();
  await expect(page.locator("[data-project-tab-loading]:visible")).toHaveCount(
    0,
  );
  await expectNoLayeredRouteLoading(page);
  return capturePortalFinalFrame(
    root,
    workspace === "project" ? "Project calculator" : "Calculator",
    `[data-calculator-workspace="${workspace}"]:has([data-calculator-command-bar]):has([data-calculator-configuration-form]):has([data-calculator-result-inspector])`,
  );
}

async function projectOverviewFinalFrame(
  page: Page,
): Promise<PortalFinalFrameCapture> {
  const root = page.locator('[data-project-overview-layout="true"]:visible');
  for (const region of [
    "orientation",
    "project-work",
    "commercial",
    "recent",
  ]) {
    await expect(
      root.locator(`[data-project-overview-region="${region}"]`),
    ).toBeVisible({ timeout: 60_000 });
  }
  await expect(page.locator("[data-project-tab-loading]:visible")).toHaveCount(
    0,
  );
  await expectNoLayeredRouteLoading(page);
  return capturePortalFinalFrame(
    root,
    "Project overview",
    '[data-project-overview-layout="true"]:has([data-project-overview-region="orientation"]):has([data-project-overview-region="project-work"]):has([data-project-overview-region="commercial"])',
  );
}

async function projectDetailFinalFrame(
  page: Page,
): Promise<PortalFinalFrameCapture> {
  const root = page.locator('[data-project-page-frame="true"]:visible');
  const navigation = root.getByRole("navigation", {
    name: "Project sections",
    exact: true,
  });
  await expect(navigation).toBeVisible({ timeout: 60_000 });
  for (const tab of ["Overview", "Calculator", "Commercial"]) {
    await expect(
      navigation.getByRole("tab", { name: tab, exact: true }),
    ).toBeVisible();
  }
  const overview = root.locator(
    '[data-project-overview-layout="true"]:visible',
  );
  for (const region of [
    "orientation",
    "project-work",
    "commercial",
    "recent",
  ]) {
    await expect(
      overview.locator(`[data-project-overview-region="${region}"]`),
    ).toBeVisible();
  }
  await expect(page.locator("[data-project-tab-loading]:visible")).toHaveCount(
    0,
  );
  await expectNoLayeredRouteLoading(page);
  return capturePortalFinalFrame(
    root,
    "Project detail",
    '[data-project-page-frame="true"]:has([aria-label="Project sections"]):has([data-project-overview-layout="true"])',
  );
}

async function commercialQuotesFinalFrame(
  page: Page,
): Promise<PortalFinalFrameCapture> {
  const root = page.locator('[data-project-commercial-view="quotes"]:visible');
  await expect(
    root.getByRole("navigation", { name: "Commercial sections", exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  const quotes = root.getByRole("region", { name: "Quotes", exact: true });
  await expect(quotes).toBeVisible();
  await expect(
    quotes.getByRole("button", { name: "Create quote", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-project-tab-loading]:visible")).toHaveCount(
    0,
  );
  return capturePortalFinalFrame(
    root,
    "Commercial quotes",
    '[data-project-commercial-view="quotes"]:has([data-quotes-view="list"])',
  );
}

async function commercialInvoicesFinalFrame(
  page: Page,
): Promise<PortalFinalFrameCapture> {
  const root = page.locator(
    '[data-project-commercial-view="invoices"]:visible',
  );
  await expect(
    root.getByRole("navigation", { name: "Commercial sections", exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    root
      .getByRole("table", { name: "Invoices", exact: true })
      .or(root.getByText("No invoices yet", { exact: true }))
      .first(),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    root.getByText("Loading invoices", { exact: false }),
  ).toHaveCount(0);
  await expect(page.locator("[data-project-tab-loading]:visible")).toHaveCount(
    0,
  );
  return capturePortalFinalFrame(
    root,
    "Commercial invoices",
    '[data-project-commercial-view="invoices"]:has([aria-label="Invoices"], [data-state="empty"])',
  );
}

async function jobPacksFinalFrame(
  page: Page,
): Promise<PortalFinalFrameCapture> {
  const root = page.locator('[data-project-tab-body="job-packs"]:visible');
  await expect(
    root.getByRole("heading", { name: "Job Packs", exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    root.getByRole("table", { name: "Job packs", exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    root.getByText("Loading job packs", { exact: false }),
  ).toHaveCount(0);
  await expect(page.locator("[data-project-tab-loading]:visible")).toHaveCount(
    0,
  );
  return capturePortalFinalFrame(
    root,
    "Job Packs",
    '[data-project-tab-body="job-packs"]:has([aria-label="Job packs"])',
  );
}

async function settleSetupFrame(
  page: Page,
  capture: PortalFinalFrameCapture,
  backgroundReady?: Locator,
): Promise<void> {
  if (backgroundReady)
    await expect(backgroundReady).toBeVisible({ timeout: 60_000 });
  await page
    .waitForLoadState("networkidle", { timeout: 5_000 })
    .catch(() => undefined);
  await assertPortalFinalFrameContinuity(capture);
}

function assertRegressionBudget(
  journey: PortalPerformanceJourney,
  budget: JourneyBudget,
) {
  if (!budget.enforced || budget.aggregation === "p75") return;
  expect(
    journey.feedbackMs,
    `${journey.name} feedback ${journey.feedbackMs}ms exceeded ${budget.feedbackMsMax}ms`,
  ).toBeLessThanOrEqual(budget.feedbackMsMax);
  expect(
    journey.usefulContentMs,
    `${journey.name} useful content ${journey.usefulContentMs}ms exceeded ${budget.usefulContentMsMax}ms`,
  ).toBeLessThanOrEqual(budget.usefulContentMsMax);
  if (budget.liveDataReadyMsMax !== undefined) {
    expect(
      journey.liveDataReadyMs,
      `${journey.name} live data ${journey.liveDataReadyMs ?? 'missing'}ms exceeded ${budget.liveDataReadyMsMax}ms`,
    ).toBeLessThanOrEqual(budget.liveDataReadyMsMax);
  }
}

async function measureColdRoute(
  page: Page,
  name: string,
  ready: FinalFrameReady,
) {
  const budget = routeBudget(name);
  const probe = await beginPortalJourney(page, { cold: true });

  await page.goto(budget.route);
  await expect(
    page
      .locator(
        '[data-portal-sidebar-rail="true"], [data-portal-sidebar-panel="true"]',
      )
      .first(),
  ).toBeVisible({ timeout: 60_000 });
  const feedbackMs = elapsedJourneyMs(probe);
  const finalFrame = await ready();
  const usefulContentMs = elapsedJourneyMs(probe);
  const backgroundSettledMs = await waitForBackgroundSettled(page, probe);
  await assertPortalFinalFrameContinuity(finalFrame);

  const regressionBudgetMet =
    feedbackMs <= budget.shellVisibleMsMax &&
    usefulContentMs <= budget.contentVisibleMsMax;
  const journey = await finishPortalJourney(page, probe, {
    name,
    kind: "cold-route",
    feedbackMs,
    usefulContentMs,
    backgroundSettledMs,
    productTargetMet: feedbackMs <= budgets.productTargets.feedbackMsMax,
    regressionBudgetMet,
  });
  journey.productTargetMet =
    journey.productTargetMet &&
    journey.longestTaskMs <= budgets.productTargets.longestTaskMsMax &&
    !journey.blockingOverlaySeen;
  recordJourney(journey);

  expect(
    feedbackMs,
    `${budget.route} shell visible ${feedbackMs}ms exceeded ${budget.shellVisibleMsMax}ms`,
  ).toBeLessThanOrEqual(budget.shellVisibleMsMax);
  expect(
    usefulContentMs,
    `${budget.route} content visible ${usefulContentMs}ms exceeded ${budget.contentVisibleMsMax}ms`,
  ).toBeLessThanOrEqual(budget.contentVisibleMsMax);
}

async function discoverFirstProjectDetailRoute(
  browser: Browser,
  authenticatedPage: Page,
): Promise<string> {
  const storageState = await authenticatedPage.context().storageState();
  const discoveryContext = await browser.newContext({ storageState });
  try {
    const discoveryPage = await discoveryContext.newPage();
    await discoveryPage.goto("/staff/projects");
    const openLink = await firstProjectOpenLink(discoveryPage);
    const href = await openLink.getAttribute("href");
    expect(
      href,
      "The authenticated performance account needs an active project for the cold detail journey.",
    ).toBeTruthy();
    const segments = new URL(String(href), discoveryPage.url()).pathname
      .split("/")
      .filter(Boolean);
    const projectId = segments.at(-1);
    expect(
      projectId,
      "The authenticated performance account needs an active project for the cold detail journey.",
    ).toBeTruthy();
    return `/staff/projects/${encodeURIComponent(String(projectId))}`;
  } finally {
    await discoveryContext.close();
  }
}

async function discoverGeneratedJobPackProjectRoute(): Promise<string> {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  expect(
    supabaseUrl,
    "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required to discover conditional Job Packs coverage.",
  ).toBeTruthy();
  expect(
    serviceRoleKey,
    "SUPABASE_SERVICE_ROLE_KEY is required to discover conditional Job Packs coverage.",
  ).toBeTruthy();

  const endpoint = new URL(
    "/rest/v1/job_pack_generations",
    String(supabaseUrl),
  );
  endpoint.searchParams.set("select", "project_id");
  endpoint.searchParams.set("order", "created_at.desc");
  endpoint.searchParams.set("limit", "1");
  const response = await fetch(endpoint, {
    headers: {
      apikey: String(serviceRoleKey),
      authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  expect(
    response.ok,
    `Job Packs performance prerequisite query failed with ${response.status}.`,
  ).toBe(true);
  const rows = (await response.json()) as Array<{ project_id?: unknown }>;
  const projectId =
    typeof rows[0]?.project_id === "string" ? rows[0].project_id : "";
  expect(
    projectId,
    "The authenticated performance database needs at least one generated job pack.",
  ).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  return `/staff/projects/proj_${projectId}`;
}

async function measureColdProjectDetail(page: Page, route: string) {
  const budget = routeBudget("project-detail-cold");
  const probe = await beginPortalJourney(page, { cold: true });

  await page.goto(route);
  await expect(
    page
      .locator(
        '[data-portal-sidebar-rail="true"], [data-portal-sidebar-panel="true"]',
      )
      .first(),
  ).toBeVisible({ timeout: 60_000 });
  const feedbackMs = elapsedJourneyMs(probe);
  const finalFrame = await projectDetailFinalFrame(page);
  const usefulContentMs = elapsedJourneyMs(probe);
  await expect(
    page.locator('[data-project-background-ready="true"]'),
  ).toBeVisible({ timeout: 60_000 });
  const backgroundSettledMs = await waitForBackgroundSettled(page, probe);
  await assertPortalFinalFrameContinuity(finalFrame);

  const regressionBudgetMet =
    feedbackMs <= budget.shellVisibleMsMax &&
    usefulContentMs <= budget.contentVisibleMsMax;
  const journey = await finishPortalJourney(page, probe, {
    name: budget.name,
    kind: "cold-route",
    feedbackMs,
    usefulContentMs,
    backgroundSettledMs,
    productTargetMet: feedbackMs <= budgets.productTargets.feedbackMsMax,
    regressionBudgetMet,
  });
  journey.productTargetMet =
    journey.productTargetMet &&
    journey.longestTaskMs <= budgets.productTargets.longestTaskMsMax &&
    !journey.blockingOverlaySeen;
  recordJourney(journey);

  expect(
    feedbackMs,
    `${budget.route} shell visible ${feedbackMs}ms exceeded ${budget.shellVisibleMsMax}ms`,
  ).toBeLessThanOrEqual(budget.shellVisibleMsMax);
  expect(
    usefulContentMs,
    `${budget.route} content visible ${usefulContentMs}ms exceeded ${budget.contentVisibleMsMax}ms`,
  ).toBeLessThanOrEqual(budget.contentVisibleMsMax);
}

async function measureWarmJourney(
  page: Page,
  name: string,
  action: () => Promise<unknown>,
  feedbackReady: () => Promise<unknown>,
  usefulContentReady: () => Promise<PortalFinalFrameCapture>,
  backgroundReady?: () => Promise<unknown>,
) {
  const budget = warmBudget(name);
  const probe = await beginPortalJourney(page);
  await action();
  await feedbackReady();
  const feedbackMs = elapsedJourneyMs(probe);
  const finalFrame = await usefulContentReady();
  const usefulContentMs = elapsedJourneyMs(probe);
  await backgroundReady?.();
  const liveDataReadyMs = backgroundReady ? elapsedJourneyMs(probe) : undefined;
  const backgroundSettledMs = await waitForBackgroundSettled(page, probe);
  await assertPortalFinalFrameContinuity(finalFrame);
  const regressionBudgetMet =
    feedbackMs <= budget.feedbackMsMax &&
    usefulContentMs <= budget.usefulContentMsMax;
  const productFeedbackMsMax =
    budget.productFeedbackMsMax ?? budgets.productTargets.feedbackMsMax;
  const journey = await finishPortalJourney(page, probe, {
    name,
    kind: "warm-navigation",
    feedbackMs,
    usefulContentMs,
    liveDataReadyMs,
    backgroundSettledMs,
    productTargetMet:
      feedbackMs <= productFeedbackMsMax &&
      usefulContentMs <= budgets.productTargets.cachedContentMsMax,
    regressionBudgetMet,
  });
  journey.productTargetMet =
    journey.productTargetMet &&
    journey.longestTaskMs <= budgets.productTargets.longestTaskMsMax &&
    !journey.blockingOverlaySeen;
  recordJourney(journey);
  assertRegressionBudget(journey, budget);
}

async function measureInteraction(
  page: Page,
  name: string,
  action: () => Promise<unknown>,
  feedbackReady: () => Promise<unknown>,
  usefulContentReady?: () => Promise<PortalFinalFrameCapture>,
  backgroundReady?: () => Promise<unknown>,
) {
  const budget = interactionBudget(name);
  const probe = await beginPortalJourney(page);
  await action();
  await feedbackReady();
  const feedbackMs = elapsedJourneyMs(probe);
  const finalFrame = await usefulContentReady?.();
  const usefulContentMs = elapsedJourneyMs(probe);
  await backgroundReady?.();
  const liveDataReadyMs = backgroundReady ? elapsedJourneyMs(probe) : undefined;
  const backgroundSettledMs = await waitForBackgroundSettled(page, probe);
  if (finalFrame) await assertPortalFinalFrameContinuity(finalFrame);
  const regressionBudgetMet =
    feedbackMs <= budget.feedbackMsMax &&
    usefulContentMs <= budget.usefulContentMsMax;
  const journey = await finishPortalJourney(page, probe, {
    name,
    kind: "interaction",
    feedbackMs,
    usefulContentMs,
    liveDataReadyMs,
    backgroundSettledMs,
    productTargetMet:
      feedbackMs <=
        (budget.productFeedbackMsMax ?? budgets.productTargets.feedbackMsMax) &&
      journeyContentWithinTarget(name, usefulContentMs),
    regressionBudgetMet,
  });
  journey.productTargetMet =
    journey.productTargetMet &&
    journey.longestTaskMs <= budgets.productTargets.longestTaskMsMax &&
    !journey.blockingOverlaySeen;
  recordJourney(journey);
  assertRegressionBudget(journey, budget);
}

function journeyContentWithinTarget(
  name: string,
  usefulContentMs: number,
): boolean {
  if (name.startsWith("project-tab-")) {
    return usefulContentMs <= budgets.productTargets.cachedContentMsMax;
  }
  return true;
}

async function measureProjectTab(
  page: Page,
  name: string,
  tab: Locator,
  usefulContentReady: () => Promise<PortalFinalFrameCapture>,
  backgroundReady?: () => Promise<unknown>,
) {
  await expect(tab).toBeVisible({ timeout: 60_000 });
  await measureInteraction(
    page,
    name,
    async () => {
      await tab.hover();
      await tab.click();
    },
    () => expect(tab).toHaveAttribute("aria-selected", "true"),
    usefulContentReady,
    backgroundReady,
  );
}

async function firstProjectOpenLink(page: Page): Promise<Locator> {
  const projects = page.getByRole("region", { name: "Projects list" });
  await expect(projects).toBeVisible({ timeout: 60_000 });
  const openLink = projects.getByRole("link", { name: "Open" }).first();
  await expect(openLink).toBeVisible({ timeout: 60_000 });
  return openLink;
}

async function prepareDashboardNavigation(
  page: Page,
  parent?: "Projects" | "Pricebook",
): Promise<void> {
  await page.goto("/dashboard");
  await settleSetupFrame(
    page,
    await dashboardFinalFrame(page),
    page.locator('[data-dashboard-background-ready="true"]'),
  );
  if (!parent) return;
  const expand = page
    .getByRole("button", { name: `Expand ${parent}`, exact: true })
    .first();
  if (await expand.count()) await expand.click();
}

async function measurePortalShellNavigation(
  page: Page,
  input: {
    name: string;
    link: Locator;
    feedback: Locator;
    finalFrame: FinalFrameReady;
    backgroundReady?: () => Promise<unknown>;
    intentStartsData?: boolean;
  },
): Promise<void> {
  await expect(input.link).toBeVisible({ timeout: 60_000 });
  if (!input.intentStartsData) await input.link.hover();
  await measureWarmJourney(
    page,
    input.name,
    async () => {
      if (input.intentStartsData) await input.link.hover();
      await input.link.dispatchEvent("click");
    },
    () =>
      expect(
        page
          .locator('[data-portal-route-progress="true"]')
          .or(input.feedback)
          .first(),
      ).toBeVisible(),
    input.finalFrame,
    input.backgroundReady,
  );
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await installPortalPerformanceProbe(page);
});

test("captures cold portal route metrics", async ({ browser, page }) => {
  const projectRoute = await discoverFirstProjectDetailRoute(browser, page);
  const coldProjectContext = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  try {
    const coldProjectPage = await coldProjectContext.newPage();
    await installPortalPerformanceProbe(coldProjectPage);
    await measureColdProjectDetail(coldProjectPage, projectRoute);
  } finally {
    await coldProjectContext.close();
  }

  await measureColdRoute(page, "dashboard-cold", () =>
    dashboardFinalFrame(page),
  );
  await measureColdRoute(page, "projects-cold", () => projectsFinalFrame(page));
  await measureColdRoute(page, "contacts-cold", () => contactsFinalFrame(page));
  await measureColdRoute(page, "schedule-cold", () => scheduleFinalFrame(page));
});

test("captures warm navigation and project tab metrics", async ({ page }) => {
  await page.goto("/dashboard");
  await settleSetupFrame(
    page,
    await dashboardFinalFrame(page),
    page.locator('[data-dashboard-background-ready="true"]'),
  );
  const projectsNavLink = page
    .getByRole("link", { name: "Projects", exact: true })
    .first();
  await projectsNavLink.hover();

  await measureWarmJourney(
    page,
    "dashboard-to-projects",
    () => projectsNavLink.dispatchEvent("click"),
    () =>
      expect(
        page
          .locator('[data-portal-route-progress="true"]')
          .or(page.locator('[data-portal-page-shell="projects"]'))
          .first(),
      ).toBeVisible(),
    () => projectsFinalFrame(page),
    () =>
      expect(
        page.locator('[data-projects-index-background-ready="true"]'),
      ).toBeVisible({ timeout: 60_000 }),
  );

  const firstOpen = await firstProjectOpenLink(page);
  await firstOpen.hover();
  await measureWarmJourney(
    page,
    "projects-to-project",
    () => firstOpen.dispatchEvent("click"),
    () =>
      expect(
        page
          .locator('[data-portal-route-progress="true"]')
          .or(page.locator('[data-portal-page-shell="project-detail"]'))
          .first(),
      ).toBeVisible(),
    () => projectDetailFinalFrame(page),
    async () => {
      await expect(
        page.locator('[data-project-background-ready="true"]'),
      ).toBeVisible({ timeout: 60_000 });
      await expect(page.locator("[data-project-tab-loading]")).toHaveCount(0, {
        timeout: 60_000,
      });
      await expect(
        page.locator("[data-project-tab-awaiting-snapshot]"),
      ).toHaveCount(0, { timeout: 60_000 });
    },
  );

  await measureWarmJourney(
    page,
    "project-back-to-projects",
    () => page.goBack(),
    () =>
      expect(page.locator('[data-portal-page-shell="projects"]')).toBeVisible(),
    () => projectsFinalFrame(page),
  );

  const reopen = await firstProjectOpenLink(page);
  await reopen.hover();
  await reopen.click();
  await settleSetupFrame(
    page,
    await projectDetailFinalFrame(page),
    page.locator('[data-project-background-ready="true"]'),
  );

  const calculatorTab = page.getByRole("tab", {
    name: "Calculator",
    exact: true,
  });
  await measureProjectTab(page, "project-tab-calculator", calculatorTab, () =>
    calculatorFinalFrame(page, "project"),
    () => expect(page.locator('[data-result-freshness="current"]:visible').first()).toBeVisible({ timeout: 60_000 }),
  );

  const commercialTab = page.getByRole("tab", {
    name: "Commercial",
    exact: true,
  });
  await measureProjectTab(
    page,
    "project-tab-commercial-quotes",
    commercialTab,
    () => commercialQuotesFinalFrame(page),
    () => expect(page.getByText("Quote list structure is ready. Quote values are loading.", { exact: true })).toHaveCount(0, { timeout: 60_000 }),
  );

  const invoicesTab = page.getByRole("tab", { name: "Invoices", exact: true });
  await measureProjectTab(
    page,
    "project-tab-commercial-invoices",
    invoicesTab,
    () => commercialInvoicesFinalFrame(page),
    () => expect(page.getByText("Invoice list structure is ready. Invoice values are loading.", { exact: true })).toHaveCount(0, { timeout: 60_000 }),
  );

  const overviewTab = page.getByRole("tab", { name: "Overview", exact: true });
  await measureProjectTab(page, "project-tab-overview", overviewTab, () =>
    projectOverviewFinalFrame(page),
  );

  let jobPacksTab = page.getByRole("tab", { name: "Job Packs", exact: true });
  if ((await jobPacksTab.count()) === 0) {
    await page.goto(await discoverGeneratedJobPackProjectRoute());
    await settleSetupFrame(
      page,
      await projectDetailFinalFrame(page),
      page.locator('[data-project-background-ready="true"]'),
    );
    jobPacksTab = page.getByRole("tab", { name: "Job Packs", exact: true });
  }
  await expect(
    jobPacksTab,
    "The authenticated performance project needs generated job packs so the conditional current tab is measured.",
  ).toBeVisible({ timeout: 60_000 });
  await measureProjectTab(page, "project-tab-job-packs", jobPacksTab, () =>
    jobPacksFinalFrame(page),
  );
});

test("captures warm Contacts navigation", async ({ page }) => {
  await page.goto("/dashboard");
  await settleSetupFrame(
    page,
    await dashboardFinalFrame(page),
    page.locator('[data-dashboard-background-ready="true"]'),
  );
  const contactsNavLink = page
    .getByRole("link", { name: "Contacts", exact: true })
    .first();
  await contactsNavLink.hover();

  await measureWarmJourney(
    page,
    "dashboard-to-contacts",
    () => contactsNavLink.dispatchEvent("click"),
    () =>
      expect(
        page
          .locator('[data-portal-route-progress="true"]')
          .or(page.locator('[data-portal-page-shell="contacts"]'))
          .first(),
      ).toBeVisible(),
    () => contactsFinalFrame(page),
    () =>
      expect(
        page.locator('[data-contacts-index-background-ready="true"]'),
      ).toBeVisible({ timeout: 60_000 }),
  );
});

test("captures Dashboard revisit after a realistic idle period", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto("/dashboard");
  await settleSetupFrame(
    page,
    await dashboardFinalFrame(page),
    page.locator('[data-dashboard-background-ready="true"]'),
  );

  const projectsNavLink = page
    .getByRole("link", { name: "Projects", exact: true })
    .first();
  await projectsNavLink.hover();
  await projectsNavLink.dispatchEvent("click");
  await page.waitForURL(/\/staff\/projects(?:\?|$)/);
  await settleSetupFrame(
    page,
    await projectsFinalFrame(page),
    page.locator('[data-projects-index-background-ready="true"]'),
  );

  const originalTimeOrigin = await page.evaluate(() => {
    const isAuthenticated = () =>
      document.querySelector(
        '[data-portal-shell-auth-state="authenticated"]',
      ) !== null;
    const probe = {
      broken: !isAuthenticated(),
      observer: new MutationObserver(() => {
        if (!isAuthenticated()) probe.broken = true;
      }),
    };
    probe.observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["data-portal-shell-auth-state"],
    });
    window.__portalIdleRevisitProbe = probe;
    return performance.timeOrigin;
  });

  const backgroundPage = await page.context().newPage();
  try {
    await backgroundPage.goto("about:blank");
    await backgroundPage.bringToFront();
    await page.waitForTimeout(2 * 60 * 1_000 + 1_000);
    await page.bringToFront();
    await page.waitForTimeout(1_000);
  } finally {
    await backgroundPage.close();
  }

  const idleState = await page.evaluate(() => ({
    authenticated:
      document.querySelector(
        '[data-portal-shell-auth-state="authenticated"]',
      ) !== null,
    boundaryWasLost: window.__portalIdleRevisitProbe?.broken ?? true,
    timeOrigin: performance.timeOrigin,
  }));
  expect(idleState.timeOrigin).toBe(originalTimeOrigin);
  expect(idleState.authenticated).toBe(true);
  expect(idleState.boundaryWasLost).toBe(false);

  const dashboardNavLink = page
    .getByRole("link", { name: "Dashboard", exact: true })
    .first();
  await expect(dashboardNavLink).toBeVisible();
  await measureWarmJourney(
    page,
    "dashboard-idle-revisit",
    () => dashboardNavLink.dispatchEvent("click"),
    () =>
      expect(
        page
          .locator('[data-portal-route-progress="true"]')
          .or(page.locator('[data-portal-page-shell="dashboard"]'))
          .first(),
      ).toBeVisible(),
    () => dashboardFinalFrame(page),
    () =>
      expect(
        page.locator('[data-dashboard-background-ready="true"]'),
      ).toBeVisible({ timeout: 60_000 }),
  );
  const finalIdleBoundary = await page.evaluate(() => ({
    authenticated:
      document.querySelector(
        '[data-portal-shell-auth-state="authenticated"]',
      ) !== null,
    boundaryWasLost: window.__portalIdleRevisitProbe?.broken ?? true,
    timeOrigin: performance.timeOrigin,
  }));
  expect(finalIdleBoundary).toEqual({
    authenticated: true,
    boundaryWasLost: false,
    timeOrigin: originalTimeOrigin,
  });
  await page.evaluate(() => {
    window.__portalIdleRevisitProbe?.observer.disconnect();
    delete window.__portalIdleRevisitProbe;
  });
});

test("captures warm navigation to the remaining instant-shell routes", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/staff/projects");
  await settleSetupFrame(
    page,
    await projectsFinalFrame(page),
    page.locator('[data-projects-index-background-ready="true"]'),
  );
  await measurePortalShellNavigation(page, {
    name: "projects-to-dashboard",
    link: page.getByRole("link", { name: "Dashboard", exact: true }).first(),
    feedback: page.locator('[data-portal-page-shell="dashboard"]'),
    finalFrame: () => dashboardFinalFrame(page),
  });

  await prepareDashboardNavigation(page);
  await measurePortalShellNavigation(page, {
    name: "dashboard-to-schedule",
    link: page.getByRole("link", { name: "Schedule", exact: true }).first(),
    feedback: page.locator('[data-ui-foundation-consumer="schedule"]'),
    finalFrame: () => scheduleFinalFrame(page),
  });

  await prepareDashboardNavigation(page, "Projects");
  await measurePortalShellNavigation(page, {
    name: "dashboard-to-work-queue",
    link: page.getByRole("link", { name: "Work Queue", exact: true }).first(),
    feedback: page.locator("[data-project-work-queue-state]"),
    finalFrame: () => workQueueFinalFrame(page),
    backgroundReady: () => expect(page.locator('[data-project-work-queue-state="fresh"]')).toBeVisible({ timeout: 60_000 }),
    intentStartsData: true,
  });

  await prepareDashboardNavigation(page, "Projects");
  await measurePortalShellNavigation(page, {
    name: "dashboard-to-design-list",
    link: page
      .getByRole("link", { name: "Drafting Queue", exact: true })
      .first(),
    feedback: page.locator('[data-ui-foundation-consumer="spreadsheet"]'),
    finalFrame: () => spreadsheetFinalFrame(page, "Drafting Queue"),
  });

  await prepareDashboardNavigation(page, "Projects");
  await measurePortalShellNavigation(page, {
    name: "dashboard-to-running-jobs",
    link: page.getByRole("link", { name: "Running Jobs", exact: true }).first(),
    feedback: page.locator('[data-ui-foundation-consumer="spreadsheet"]'),
    finalFrame: () => spreadsheetFinalFrame(page, "Running Jobs"),
  });
});

test("captures schedule and calculator interaction metrics", async ({
  page,
}) => {
  await page.goto("/staff/schedule");
  await settleSetupFrame(page, await scheduleFinalFrame(page));
  const toggle = page.getByRole("button", {
    name: /Collapse unscheduled panel|Expand unscheduled panel/,
  });
  const initialExpanded = await toggle.getAttribute("aria-expanded");
  await measureInteraction(
    page,
    "schedule-unscheduled-panel-toggle",
    () => toggle.click(),
    () =>
      expect(toggle).toHaveAttribute(
        "aria-expanded",
        initialExpanded === "true" ? "false" : "true",
      ),
  );

  await page.goto("/staff/calculator");
  await settleSetupFrame(page, await calculatorFinalFrame(page, "standalone"));
  const roofLength = page
    .getByLabel("Roof Length (m)", { exact: true })
    .first();
  await expect(roofLength).toBeVisible({ timeout: 60_000 });
  const original = Number(await roofLength.inputValue()) || 6;
  const next = String(Number((original + 0.01).toFixed(2)));
  await measureInteraction(
    page,
    "calculator-input-current-result",
    () => roofLength.fill(next),
    () => expect(roofLength).toHaveValue(next),
    async () => {
      await expect(page.getByText("Live", { exact: true }).first()).toBeVisible(
        { timeout: 60_000 },
      );
      return calculatorFinalFrame(page, "standalone");
    },
  );
});

test.afterAll(async () => {
  const artifactPath =
    process.env.PORTAL_PERF_ARTIFACT?.trim() ||
    "artifacts/portal-route-timings.json";
  const payload: PortalPerformanceRun = {
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    buildId: portalPerformanceBuildId(),
    journeys,
  };
  await fs.promises.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.promises.writeFile(
    artifactPath,
    JSON.stringify(payload, null, 2),
    "utf8",
  );
});
