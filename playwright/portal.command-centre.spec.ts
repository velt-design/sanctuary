import { expect, test, type Page } from "@playwright/test";
import {
  COMMAND_CENTRE_FIXTURE_SCENARIOS,
  COMMAND_CENTRE_VIEW_STATES,
  COMMAND_CENTRE_WORK_SCENARIOS,
  commandCentreFixtureStaff,
  commandCentreFixtures,
  commandCentreWorkFixtures,
  type CommandCentreViewFixtureState,
  type CommandCentreWorkFixtureScenario,
} from "../apps/portal/app/qa/project-command-centre-fixture/fixtures";

const FIXTURE_PATH = "/qa/project-command-centre-fixture";
const PROJECT_SHELL_FIXTURE_PATH = "/qa/project-page-shell-fixture";

function fixtureUrl({
  scenario = "standard-estimate",
  work = "v2-primary",
  state = "ready",
}: {
  scenario?: string;
  work?: string;
  state?: string;
} = {}) {
  return `${FIXTURE_PATH}?scenario=${scenario}&work=${work}&state=${state}`;
}

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
    nestedVerticalScrollers: Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    )
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          ["auto", "scroll"].includes(style.overflowY) &&
          element.scrollHeight > element.clientHeight + 1
        );
      })
      .map(
        (element) =>
          element.getAttribute("data-project-overview-region") ??
          element.getAttribute("aria-label") ??
          element.tagName,
      ),
  }));
  expect(overflow.horizontal).toBe(false);
  expect(overflow.nestedVerticalScrollers).toEqual([]);
}

async function expectNoCroppedOverviewControls(page: Page) {
  const cropped = await page
    .locator('[data-project-overview-layout="true"]')
    .locator(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const control = element as HTMLElement;
        const bounds = control.getBoundingClientRect();
        const region = control.closest<HTMLElement>(
          "[data-project-overview-region]",
        );
        const regionBounds = region?.getBoundingClientRect();
        const style = getComputedStyle(control);
        const visible =
          bounds.width > 0 &&
          bounds.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none";
        const clipped =
          visible &&
          (bounds.left < -1 ||
            bounds.right > window.innerWidth + 1 ||
            control.scrollWidth > control.clientWidth + 1 ||
            Boolean(
              regionBounds &&
              (bounds.left < regionBounds.left - 1 ||
                bounds.right > regionBounds.right + 1),
            ));
        return clipped
          ? [
              control.getAttribute("aria-label") ||
                control.textContent?.trim() ||
                control.tagName,
            ]
          : [];
      }),
    );
  expect(cropped).toEqual([]);
}

const COMMERCIAL_SCENARIO_EXPECTATIONS = {
  "new-lead": ["$1,234.56 inc GST"],
  "no-current-design": ["No current design"],
  "standard-estimate": ["$1,234.56 inc GST"],
  "multiple-estimates": ["6m x 4m + 2 more"],
  "sent-revision": ["Quote sent"],
  "accepted-newer-estimate": ["Newer unrelated estimate"],
  "declined-quote": ["Latest quote declined"],
  "missing-source": ["Source design unavailable"],
  "missing-price": ["Price unavailable"],
  "missing-estimate-price": ["Estimate price unavailable"],
} as const satisfies Record<
  (typeof COMMAND_CENTRE_FIXTURE_SCENARIOS)[number],
  readonly string[]
>;

for (const scenario of COMMAND_CENTRE_FIXTURE_SCENARIOS) {
  test(`renders truthful ${scenario} commercial state in the Overview composition`, async ({
    page,
  }) => {
    await page.goto(fixtureUrl({ scenario }));
    const fixture = page.locator(
      '[data-portal-qa-fixture="project-command-centre"]',
    );
    await expect(fixture).toHaveAttribute("data-fixture-scenario", scenario);
    for (const expected of COMMERCIAL_SCENARIO_EXPECTATIONS[scenario]) {
      await expect(fixture).toContainText(expected);
    }
    await expect(fixture.locator("[data-command-centre-source]")).toBeVisible();
    await expect(
      fixture.locator('[data-project-overview-layout="true"]'),
    ).toBeVisible();
    await expect(
      fixture.locator('[data-project-work-section="true"]'),
    ).toHaveCount(1);
  });
}

const WORK_SCENARIO_EXPECTATIONS = {
  "v2-primary": {
    model: "v2",
    text: [
      "Email the customer with the first enquiry response",
      "Sam Sales",
      "Due today",
    ],
  },
  "v2-missing-email": {
    model: "v2",
    text: ["Customer email required", "the customer email is missing"],
  },
  "v2-follow-up": {
    model: "v2",
    text: [
      "Email the customer with an enquiry follow-up",
      "Overdue",
      "Customer replied",
    ],
  },
  "v2-close-review": {
    model: "v2",
    text: [
      "Review whether this enquiry should stay active",
      "A staff decision is required",
      "Nothing happens automatically",
    ],
  },
  "v2-critical": {
    model: "v2",
    text: [
      "Prepare the revised design brief",
      "Critical",
      "The customer decision is blocked",
    ],
  },
  "v2-overdue": {
    model: "v2",
    text: ["Email the customer with an enquiry follow-up", "Overdue"],
  },
  "v2-future": {
    model: "v2",
    text: ["Prepare the revised design brief", "Jordan", "3 Aug 2026"],
  },
  "v2-long-content": {
    model: "v2",
    text: ["Confirm the revised multi-zone outdoor living design"],
  },
  "v2-blocked": {
    model: "v2",
    text: [
      "1 blocked project-work item",
      "Resolve missing site measurements",
      "Measurements have not been supplied",
    ],
  },
  "v2-no-owner": {
    model: "v2",
    text: ["Prepare the revised design brief", "Unassigned"],
  },
  "v2-no-action": {
    model: "v2",
    text: ["No current project work", "The server has no current next action"],
  },
  "v2-correction-review": {
    model: "v2",
    text: [
      "Needs triage",
      "A corrected confirmation requires explicit project-work review",
    ],
  },
  "v2-waiting": {
    model: "v2",
    text: ["Waiting", "Review waiting project", "Waiting until"],
  },
  "v2-closed": {
    model: "v2",
    text: ["Project closed", "lost timing deferred"],
  },
  "v2-archived": {
    model: "v2",
    text: [
      "Archived",
      "Project archived",
      "Archived projects remain read-only",
    ],
  },
  "v2-stage-review": {
    model: "v2",
    text: ["Review proposal outcome", "commercial", "Complete"],
  },
  "v2-triage": {
    model: "v2",
    text: ["Needs triage", "No ranked current work is available"],
  },
} as const satisfies Record<
  CommandCentreWorkFixtureScenario,
  { model: "v2"; text: readonly string[] }
>;

for (const work of COMMAND_CENTRE_WORK_SCENARIOS) {
  test(`renders one ${work} Project Work surface`, async ({ page }) => {
    await page.goto(fixtureUrl({ work }));
    const fixture = page.locator(
      '[data-portal-qa-fixture="project-command-centre"]',
    );
    const projectWork = fixture.locator('[data-project-work-section="true"]');
    const expected = WORK_SCENARIO_EXPECTATIONS[work];
    await expect(fixture).toHaveAttribute("data-work-scenario", work);
    await expect(projectWork).toHaveCount(1);
    await expect(projectWork).toHaveAttribute(
      "data-project-work-model",
      expected.model,
    );
    for (const text of expected.text) {
      await expect(projectWork).toContainText(text);
    }
    await expect(fixture.locator("[data-stage3-workstreams-slot]")).toHaveCount(
      0,
    );
    await expect(fixture.locator('[data-overview-column="tasks"]')).toHaveCount(
      0,
    );
  });
}

const READ_STATE_EXPECTATIONS = {
  ready: {
    layoutState: "ready",
    workModel: "v2",
    text: ["Email the customer with the first enquiry response"],
    emailControl: "enabled",
  },
  refreshing: {
    layoutState: "refreshing",
    workModel: "v2",
    text: [
      "Refreshing the Overview",
      "Email the customer with the first enquiry response",
      "Work controls paused",
    ],
    emailControl: "disabled",
  },
  stale: {
    layoutState: "stale",
    workModel: "v2",
    text: [
      "Showing a saved Overview",
      "Email the customer with the first enquiry response",
      "Work controls paused",
    ],
    emailControl: "disabled",
  },
  "model-mismatch": {
    layoutState: "model-mismatch",
    workModel: "mismatch",
    text: [
      "Project work is updating",
      "No action is available until server reads agree",
    ],
    emailControl: "absent",
  },
  summary: {
    layoutState: "summary",
    workModel: "v2",
    text: [
      "Loading the complete project",
      "Email the customer with the first enquiry response",
      "Updating recent history",
    ],
    emailControl: "disabled",
  },
  pending: {
    layoutState: "pending",
    workModel: "pending",
    text: [
      "Loading Project Work",
      "Loading current design and commercial state",
    ],
    emailControl: "absent",
  },
  failed: {
    layoutState: "failed",
    workModel: "failed",
    text: [
      "Could not load the Project Overview",
      "No next action or commercial position is available",
    ],
    emailControl: "absent",
  },
  retry: {
    layoutState: "retry",
    workModel: "failed",
    text: ["Could not load the Project Overview", "Retry"],
    emailControl: "absent",
    retryCount: 1,
  },
  "access-401": {
    layoutState: "unavailable",
    workModel: "unavailable",
    text: ["Project access unavailable", "Commercial state unavailable", "401"],
    emailControl: "absent",
  },
  "access-403": {
    layoutState: "unavailable",
    workModel: "unavailable",
    text: ["Project access unavailable", "Commercial state unavailable", "403"],
    emailControl: "absent",
  },
  "access-404": {
    layoutState: "unavailable",
    workModel: "unavailable",
    text: ["Project access unavailable", "Commercial state unavailable", "404"],
    emailControl: "absent",
  },
} as const satisfies Record<
  CommandCentreViewFixtureState,
  {
    layoutState: string;
    workModel: string;
    text: readonly string[];
    emailControl: "enabled" | "disabled" | "absent";
    retryCount?: number;
  }
>;

for (const state of COMMAND_CENTRE_VIEW_STATES) {
  test(`renders the ${state} Overview read state without duplicate work`, async ({
    page,
  }) => {
    await page.goto(fixtureUrl({ state }));
    const fixture = page.locator(
      '[data-portal-qa-fixture="project-command-centre"]',
    );
    const layout = page.locator('[data-project-overview-layout="true"]');
    const expected = READ_STATE_EXPECTATIONS[state];
    await expect(fixture).toHaveAttribute("data-view-state", state);
    if (state.startsWith("access-")) {
      const status = state.slice(-3);
      const accessBoundary = fixture.locator(
        `[data-project-access-boundary="${status}"]`,
      );
      await expect(accessBoundary).toBeVisible();
      await expect(accessBoundary).toContainText("Project access unavailable");
      await expect(accessBoundary).toContainText(status);
      await expect(layout).toHaveCount(0);
      await expect(
        fixture.locator('[data-project-orientation="true"]'),
      ).toHaveCount(0);
      await expect(
        fixture.locator('[data-project-work-section="true"]'),
      ).toHaveCount(0);
      await expect(fixture.locator("[data-command-centre-source]")).toHaveCount(
        0,
      );
      await expect(
        fixture.locator('[data-recent-notes-events="true"]'),
      ).toHaveCount(0);
      return;
    }

    const projectWork = layout.locator('[data-project-work-section="true"]');
    await expect(layout).toHaveAttribute(
      "data-command-centre-state",
      expected.layoutState,
    );
    await expect(projectWork).toHaveCount(1);
    await expect(projectWork).toHaveAttribute(
      "data-project-work-model",
      expected.workModel,
    );
    for (const text of expected.text) {
      await expect(layout).toContainText(text);
    }

    const emailControl = layout.getByRole("button", { name: "Email sent" });
    if (expected.emailControl === "enabled") {
      await expect(emailControl).toBeEnabled();
    } else if (expected.emailControl === "disabled") {
      await expect(emailControl).toBeDisabled();
    } else {
      await expect(emailControl).toHaveCount(0);
    }

    if ("retryCount" in expected) {
      await expect(layout.getByRole("button", { name: "Retry" })).toHaveCount(
        expected.retryCount,
      );
    }
  });
}

const OVERVIEW_VIEWPORTS = [
  [1440, 1000],
  [1280, 800],
  [1024, 900],
  [768, 1024],
  [390, 844],
] as const;

for (const [width, height] of OVERVIEW_VIEWPORTS) {
  test(`keeps the approved Overview composition usable at ${width}x${height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto(fixtureUrl({ work: "v2-blocked" }));
    const layout = page.locator('[data-project-overview-layout="true"]');
    await expect(layout).toBeVisible();
    await expect(
      layout.locator('[data-project-work-section="true"]'),
    ).toHaveCount(1);
    await expect(
      layout.locator('[data-project-orientation="true"]'),
    ).toBeVisible();
    await expect(layout.locator("[data-command-centre-source]")).toBeVisible();
    await expect(
      layout.locator('[data-recent-notes-events="true"]'),
    ).toBeVisible();
    await expect(layout).toContainText("1 blocked project-work item");
    await expect(layout).toContainText("Sam Sales");
    await expect(layout).toContainText("Due");
    await expect(layout).toContainText("$1,234.56 inc GST");
    await expect(layout).toContainText("No current quote");

    const regionOrder = await layout
      .locator(":scope > [data-project-overview-region]")
      .evaluateAll((regions) =>
        regions.map((region) =>
          region.getAttribute("data-project-overview-region"),
        ),
      );
    if (width <= 768) {
      expect(regionOrder).toEqual([
        "project-work",
        "commercial",
        "orientation",
        "recent",
      ]);
    } else {
      expect(regionOrder).toEqual([
        "orientation",
        "project-work",
        "commercial",
        "recent",
      ]);
    }
    await expectNoDocumentOverflow(page);
    await expectNoCroppedOverviewControls(page);
    await testInfo.attach(`overview-${width}x${height}.png`, {
      body: await layout.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
  });
}

for (const [width, height] of OVERVIEW_VIEWPORTS) {
  test(`contains long Overview content at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto(fixtureUrl({ work: "v2-long-content" }));
    const layout = page.locator('[data-project-overview-layout="true"]');
    await expect(layout).toContainText(
      "Alexandra Montgomery and Christopher Williamson",
    );
    await expect(layout).toContainText(
      "Apartment 14, 1847 Great North Road, Point Chevalier, Auckland",
    );
    await expect(layout).toContainText(
      "Confirm the revised multi-zone outdoor living design, final customer selections, and installation constraints",
    );
    await expectNoDocumentOverflow(page);
    await expectNoCroppedOverviewControls(page);
  });
}

test("reflows at the effective CSS viewport of 200% browser zoom", async ({
  page,
}) => {
  // A 1280px browser at 200% exposes roughly a 640 CSS-pixel layout viewport.
  await page.setViewportSize({ width: 640, height: 500 });
  await page.goto(fixtureUrl({ work: "v2-blocked" }));
  const layout = page.locator('[data-project-overview-layout="true"]');
  await expect(
    layout.locator('[data-project-work-section="true"]'),
  ).toBeVisible();
  await expect(layout.locator("[data-command-centre-source]")).toBeVisible();
  await expect(
    layout.locator('[data-project-orientation="true"]'),
  ).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("keeps semantic structure, mobile keyboard order, visible focus and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(fixtureUrl({ work: "v2-primary" }));
  const layout = page.locator('[data-project-overview-layout="true"]');
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Approved Overview V2 composition",
    }),
  ).toHaveCount(1);
  for (const heading of [
    "Project Work",
    "Current design & commercial",
    "Project orientation",
    "Recent notes and events",
  ]) {
    await expect(
      layout.getByRole("heading", { level: 2, name: heading }),
    ).toHaveCount(1);
  }
  for (const region of [
    "Project Work",
    "Current design and commercial summary",
    "Project orientation",
    "Recent notes and events",
  ]) {
    await expect(
      layout.getByRole("region", { name: region, exact: true }),
    ).toHaveCount(1);
  }

  const tabStops = await layout
    .locator(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const control = element as HTMLElement;
        const bounds = control.getBoundingClientRect();
        const style = getComputedStyle(control);
        if (
          control.tabIndex < 0 ||
          bounds.width <= 0 ||
          bounds.height <= 0 ||
          style.visibility === "hidden" ||
          style.display === "none"
        ) {
          return [];
        }
        const index = control.dataset.overviewTabStop
          ? Number(control.dataset.overviewTabStop)
          : -1;
        return [
          {
            index,
            region:
              control
                .closest<HTMLElement>("[data-project-overview-region]")
                ?.getAttribute("data-project-overview-region") ?? null,
          },
        ];
      }),
    );
  const visibleTabStops = layout.locator(
    'a[href]:visible, button:not([disabled]):visible, input:not([disabled]):visible, select:not([disabled]):visible, textarea:not([disabled]):visible, [tabindex]:not([tabindex="-1"]):visible',
  );
  const tabStopCount = await visibleTabStops.count();
  await visibleTabStops.evaluateAll((elements) => {
    elements.forEach((element, index) => {
      (element as HTMLElement).dataset.overviewTabStop = String(index);
    });
  });
  const tabStopRegions = await visibleTabStops.evaluateAll((elements) =>
    elements.map(
      (element) =>
        element
          .closest<HTMLElement>("[data-project-overview-region]")
          ?.getAttribute("data-project-overview-region") ?? null,
    ),
  );
  expect(tabStops.length).toBe(tabStopCount);
  expect(
    tabStopRegions.filter(
      (region, index) => region && region !== tabStopRegions[index - 1],
    ),
  ).toEqual(["project-work", "commercial", "orientation", "recent"]);

  await page.locator('[data-overview-tab-stop="0"]').focus();
  for (let index = 1; index < tabStopCount; index += 1) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () =>
          (document.activeElement as HTMLElement | null)?.dataset
            .overviewTabStop ?? null,
      ),
    ).toBe(String(index));
  }

  const primary = page.getByRole("button", { name: "Email sent" }).first();
  await primary.focus();
  await expect(primary).toBeFocused();
  const focusPresentation = await primary.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  });
  expect(
    focusPresentation.outlineStyle !== "none" ||
      focusPresentation.outlineWidth !== "0px" ||
      focusPresentation.boxShadow !== "none",
  ).toBe(true);
  const activeMotion = await layout.locator("*").evaluateAll((elements) =>
    elements.flatMap((element) => {
      const style = getComputedStyle(element);
      const durations = `${style.animationDuration},${style.transitionDuration}`
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) =>
          value.endsWith("ms")
            ? Number.parseFloat(value) / 1000
            : Number.parseFloat(value),
        );
      return durations.some(
        (duration) => Number.isFinite(duration) && duration > 0.01,
      )
        ? [
            element.getAttribute("aria-label") ||
              element.textContent?.trim().slice(0, 80) ||
              element.tagName,
          ]
        : [];
    }),
  );
  expect(activeMotion).toEqual([]);
  await expectNoCroppedOverviewControls(page);
  for (const role of ["button", "link"] as const) {
    await expect(
      layout.getByRole(role, {
        name: /\b(?:call|site visits?|accept quote|record payment|schedule|running jobs|public token)\b/i,
      }),
    ).toHaveCount(0);
  }
});

test("keeps coarse-pointer Project Work controls at least 44px high", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await page.goto(fixtureUrl({ work: "v2-primary" }));
    await expect(
      page.locator('[data-command-centre-fixture-hydrated="true"]'),
    ).toBeVisible();
    const controls = page.locator(
      '[data-project-work-section="true"] button:visible',
    );
    const heights = await controls.evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().height),
    );
    expect(heights.length).toBeGreaterThan(0);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  } finally {
    await context.close();
  }
});

test("uses the existing semantic email command with one stable submit", async ({
  page,
}) => {
  const commands: Array<Record<string, unknown>> = [];
  await page.route(
    "**/api/staff/v1/projects/proj_fixture/confirmations/commands",
    async (route) => {
      const command = route.request().postDataJSON() as Record<string, unknown>;
      commands.push(command);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          command: {
            id: command.commandId,
            committed: true,
            replayed: false,
            rowVersion: 2,
          },
        }),
      });
    },
  );

  await page.goto(fixtureUrl({ work: "v2-primary" }));
  await page.getByRole("button", { name: "Email sent" }).first().click();
  await expect(page.getByText("Saved on the server.")).toBeVisible();
  expect(commands).toHaveLength(1);
  expect(commands[0]).toMatchObject({
    command: "RECORD_FIRST_ENQUIRY_EMAIL_SENT",
    subjectId: "proj_fixture",
  });
  expect(commands[0]?.commandId).toEqual(expect.any(String));
});

const PROJECT_SHELL_VIEWPORTS = [
  [1440, 1000],
  [1280, 800],
  [1024, 900],
  [768, 1024],
  [390, 844],
] as const;

const COMMAND_CENTRE_OWNER = {
  owner: { key: "jordan", displayName: "Jordan" },
  required: true,
  missing: false,
  version: "owner-v1",
  permissions: { canManage: true },
} as const;

for (const [width, height] of PROJECT_SHELL_VIEWPORTS) {
  test(`renders the two-row project shell and one Overview work surface at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.route(
      "**/api/staff/v1/projects/proj_fixture_shell/command-centre",
      async (route) => {
        await route.fulfill({
          contentType: "application/json",
          body: v2CommandCentreBody(),
        });
      },
    );

    await page.goto(
      `${PROJECT_SHELL_FIXTURE_PATH}?tab=activity&campaign=winter`,
    );
    const fixture = page.locator(
      '[data-portal-qa-fixture="project-page-shell"]',
    );
    await expect(fixture).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Alexandra Montgomery and Christopher Williamson - North Harbour outdoor living project",
      }),
    ).toBeVisible();
    const commandRow = page.locator('[data-project-header-row="command"]');
    const tabRow = page.locator('[data-project-header-row="tabs"]');
    await expect(page.locator("[data-project-header-row]")).toHaveCount(2);
    await expect(commandRow.locator('[data-stage="sent"]')).toHaveText("Sent");
    await expect(
      commandRow.getByRole("combobox", {
        name: "Search projects and contacts",
      }),
    ).toBeVisible();
    await expect(commandRow.getByText("Owner", { exact: true })).toBeVisible();
    await expect(
      commandRow.getByRole("link", { name: "Projects", exact: true }),
    ).toBeVisible();
    await expect(
      commandRow.getByRole("link", { name: "Design Workbench" }),
    ).toBeVisible();
    await expect(commandRow.getByRole("button", { name: "More" })).toHaveCount(
      0,
    );
    await expect(commandRow).not.toContainText("Q-2042");
    await expect(commandRow).not.toContainText("proj_fixture_shell");
    await expect(
      commandRow.locator('[aria-label="Project stage"]'),
    ).toHaveCount(0);
    await expect(
      tabRow.getByRole("navigation", { name: "Project sections" }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Calculator" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Commercial" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Emails" })).toHaveCount(0);
    await expect(
      page.locator('[data-project-orientation="true"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-project-work-section="true"]'),
    ).toHaveCount(1);
    await expect(page.locator("[data-project-owner]")).toHaveCount(1);
    await expect(page.locator("[data-project-rail]")).toHaveCount(0);
    await expect(page.locator('[role="separator"]')).toHaveCount(0);

    const commandRail = commandRow.locator('[data-page-header-row="true"]');
    const commandRailOverflows = await commandRail.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    if (commandRailOverflows) {
      await commandRail.evaluate((element) =>
        element.scrollTo({ left: element.scrollWidth }),
      );
      const finalCommandIsReachable = await commandRail.evaluate((element) => {
        const finalCommand = element.querySelector<HTMLAnchorElement>(
          'a[href*="design-workbench"]',
        );
        if (!finalCommand) return false;
        const railBounds = element.getBoundingClientRect();
        const commandBounds = finalCommand.getBoundingClientRect();
        return (
          commandBounds.left >= railBounds.left - 1 &&
          commandBounds.right <= railBounds.right + 1
        );
      });
      expect(finalCommandIsReachable).toBe(true);
    }

    const stickyPosition = await page
      .locator('[data-project-masthead-slot="fixed"]')
      .evaluate((element) => getComputedStyle(element).position);
    expect(stickyPosition).toBe(width >= 768 ? "sticky" : "static");
    await expectNoDocumentOverflow(page);
  });
}

function v2CommandCentreBody(
  scenario: "v2-primary" | "v2-stage-review" = "v2-stage-review",
) {
  const fixture = commandCentreWorkFixtures[scenario];
  const projectId = "proj_fixture_shell";
  const remapItem = (item: (typeof fixture.projectWork.openItems)[number]) => ({
    ...item,
    projectId,
    subjectId: item.subjectId === "proj_fixture" ? projectId : item.subjectId,
    sourceKey: item.sourceKey?.replaceAll("proj_fixture", projectId) ?? null,
    seriesKey: item.seriesKey?.replaceAll("proj_fixture", projectId) ?? null,
  });
  const projectWork = {
    ...fixture.projectWork,
    projectId,
    primaryAction:
      fixture.projectWork.primaryAction.kind === "workItem"
        ? {
            ...fixture.projectWork.primaryAction,
            item: remapItem(fixture.projectWork.primaryAction.item),
          }
        : fixture.projectWork.primaryAction,
    openItems: fixture.projectWork.openItems.map(remapItem),
    blockedItems: fixture.projectWork.blockedItems.map(remapItem),
  };
  return JSON.stringify({
    projectId,
    workModel: "v2",
    currentDesign: commandCentreFixtures["standard-estimate"],
    projectWork,
    owner: COMMAND_CENTRE_OWNER,
    generatedAt: new Date().toISOString(),
  });
}

test("routes deterministic V2 command data through the real project shell and Overview query", async ({
  page,
}) => {
  const commandRequests: string[] = [];
  await page.route(
    "**/api/staff/v1/projects/proj_fixture_shell/command-centre",
    async (route) => {
      commandRequests.push(route.request().method());
      await route.fulfill({
        contentType: "application/json",
        body: v2CommandCentreBody("v2-primary"),
      });
    },
  );
  await page.route("**/api/staff/v1/staff-directory", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ staff: commandCentreFixtureStaff }),
    });
  });

  await page.goto(
    `${PROJECT_SHELL_FIXTURE_PATH}?tab=activity&model=v2&campaign=winter`,
  );
  const fixture = page.locator('[data-portal-qa-fixture="project-page-shell"]');
  await expect(fixture).toHaveAttribute(
    "data-project-work-fixture-model",
    "v2",
  );
  await expect(page.locator('[data-project-overview="true"]')).toBeVisible();
  const layout = page.locator('[data-project-overview-layout="true"]');
  await expect(layout).toHaveAttribute("data-command-centre-state", "ready");
  await expect(
    layout.locator(
      '[data-project-work-section="true"][data-project-work-model="v2"]',
    ),
  ).toHaveCount(1);
  await expect(layout).toContainText(
    "Email the customer with the first enquiry response",
  );
  await expect(layout.locator("[data-command-centre-source]")).toBeVisible();
  await expect(
    layout.locator('[data-recent-notes-events="true"]'),
  ).toBeVisible();
  await expect(layout.locator('[data-overview-column="tasks"]')).toHaveCount(0);
  await expect(layout.locator("[data-stage3-workstreams-slot]")).toHaveCount(0);
  expect(commandRequests).toEqual(["GET"]);
});

test("moves into Commercial while preserving unrelated project query parameters", async ({
  page,
}) => {
  await page.route(
    "**/api/staff/v1/projects/proj_fixture_shell/command-centre",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: v2CommandCentreBody(),
      });
    },
  );
  await page.goto(`${PROJECT_SHELL_FIXTURE_PATH}?tab=activity&campaign=winter`);
  await page.getByRole("tab", { name: "Commercial" }).click();
  await expect(page).toHaveURL(/tab=quotes/);
  await expect(page).toHaveURL(/campaign=winter/);
  await expect(page.getByRole("tab", { name: "Commercial" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("normalizes the retired Emails project URL to Overview", async ({
  page,
}) => {
  await page.route(
    "**/api/staff/v1/projects/proj_fixture_shell/command-centre",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: v2CommandCentreBody(),
      });
    },
  );
  await page.goto(`${PROJECT_SHELL_FIXTURE_PATH}?tab=emails&campaign=winter`);
  await expect(page).toHaveURL(/tab=activity/);
  await expect(page).toHaveURL(/campaign=winter/);
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("shows historical project designs as locked Calculator revision sources", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(
    "**/api/projects/proj_fixture_shell/estimates",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          estimates: [
            {
              id: "est_history",
              projectId: "proj_fixture_shell",
              createdAt: "2026-07-20T00:00:00.000Z",
              status: "draft",
              summary: {},
              versionLabel: "V1",
              isActiveDraft: false,
              hasSentQuote: true,
              jobPackEligible: false,
              jobPackGeneratedAt: null,
              jobPackQuoteVersionId: null,
            },
          ],
        }),
      });
    },
  );

  await page.goto(
    `${PROJECT_SHELL_FIXTURE_PATH}?tab=estimates&estimateId=est_history`,
  );
  await expect(page.getByRole("tab", { name: "Calculator" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.locator('[data-calculator-locked-source="true"]'),
  ).toContainText("cannot be edited directly");
  await expect(
    page.getByRole("button", { name: "Start revision" }),
  ).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("keeps invoice URLs inside the Commercial tab owner", async ({ page }) => {
  await page.route(
    "**/api/staff/v1/projects/proj_fixture_shell/invoices",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ invoices: [] }),
      });
    },
  );
  await page.goto(
    `${PROJECT_SHELL_FIXTURE_PATH}?tab=invoices&quoteId=q_1&campaign=winter`,
  );
  await expect(page.getByRole("tab", { name: "Commercial" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: "Invoices" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("No invoices yet")).toBeVisible();
  await expect(page).toHaveURL(/quoteId=q_1/);
  await expect(page).toHaveURL(/campaign=winter/);
});
