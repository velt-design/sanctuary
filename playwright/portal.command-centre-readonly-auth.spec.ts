import { expect, test } from "@playwright/test";

import {
  expectVisiblePortalProject,
  openPortalPage,
  withPortalBrowserEvidence,
} from "./support/portalAgent";
import {
  expectNoProjectWorkMutationRequests,
  installProjectWorkReadOnlyRequestGuard,
  requireProjectWorkReadOnlyTarget,
  suppressProjectWorkWebVitalsTelemetry,
  type BlockedProjectWorkMutation,
} from "./support/projectWorkReadOnlyAuth";

test.use({ serviceWorkers: "block" });

function expectPrivateNoStore(response: {
  headers(): Record<string, string>;
  status(): number;
}) {
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("private");
  expect(response.headers()["cache-control"]).toContain("no-store");
}

test("authenticated Projects and Dashboard expose portfolio journey and state without writes", async ({
  page,
}, testInfo) => {
  requireProjectWorkReadOnlyTarget(testInfo);

  const blockedMutations: BlockedProjectWorkMutation[] = [];
  await suppressProjectWorkWebVitalsTelemetry(page);
  await installProjectWorkReadOnlyRequestGuard(page, blockedMutations);

  try {
    await withPortalBrowserEvidence(
      page,
      testInfo,
      { phase: "project-portfolio-readonly-auth" },
      async () => {
        const projectsResponsePromise = page.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            response.request().method() === "GET"
            && url.pathname === "/api/staff/v1/projects/index"
          );
        });

        await openPortalPage(page, "/staff/projects", { heading: "Projects" });
        const projectsResponse = await projectsResponsePromise;
        expectPrivateNoStore(projectsResponse);
        await expect(
          page.locator('[data-projects-index-state="fresh"]'),
        ).toBeVisible({ timeout: 60_000 });
        await expectVisiblePortalProject(page);

        const projectsTable = page.getByRole("table", { name: "Projects" });
        await expect(projectsTable.getByRole("columnheader", {
          name: "Journey",
        })).toBeVisible();
        await expect(projectsTable.getByRole("columnheader", {
          name: "Stage",
        })).toBeVisible();
        await expect(projectsTable.getByRole("columnheader", {
          name: "State",
        })).toBeVisible();
        const firstProjectRow = projectsTable.getByRole("row").nth(1);
        await expect(firstProjectRow.locator('[data-column="Journey"]'))
          .not.toHaveText("");
        await expect(firstProjectRow.locator('[data-column="State"]'))
          .toHaveText(/^(Active|Waiting|Closed|Archived)$/);

        const dashboardResponsePromise = page.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            response.request().method() === "GET"
            && url.pathname === "/api/dashboard"
          );
        });
        await openPortalPage(page, "/dashboard", { heading: "Dashboard" });
        const dashboardResponse = await dashboardResponsePromise;
        expectPrivateNoStore(dashboardResponse);
        await expect(
          page.locator('[data-dashboard-state="fresh"]'),
        ).toBeVisible({ timeout: 60_000 });

        const portfolio = page.getByRole("region", {
          name: "Project portfolio",
        });
        await expect(portfolio).toBeVisible();
        for (const phase of [
          "Enquiry",
          "Proposal",
          "Confirmed",
          "Delivery",
          "Settled",
        ]) {
          await expect(portfolio.getByText(phase, { exact: true })).toBeVisible();
        }
        await expect(
          portfolio.locator('[data-project-state-counts="ready"]'),
        ).toBeVisible();
        for (const state of ["Active", "Waiting", "Closed", "Archived"]) {
          await expect(portfolio.getByText(state, { exact: true })).toBeVisible();
        }
        await expect(
          page.getByRole("region", { name: "Work Queue" }),
        ).toBeVisible();
        await expect(
          page.getByText(/Project actions (?:overdue|due today)/i),
        ).toHaveCount(0);
      },
    );
  } finally {
    expectNoProjectWorkMutationRequests(blockedMutations);
  }
});

test("authenticated Project Overview is one read-only command-centre surface", async ({
  page,
}, testInfo) => {
  requireProjectWorkReadOnlyTarget(testInfo);

  const blockedMutations: BlockedProjectWorkMutation[] = [];
  await suppressProjectWorkWebVitalsTelemetry(page);
  await installProjectWorkReadOnlyRequestGuard(page, blockedMutations);

  try {
    await withPortalBrowserEvidence(
      page,
      testInfo,
      { phase: "command-centre-readonly-auth" },
      async () => {
        await openPortalPage(page, "/staff/projects", { heading: "Projects" });
        await expectVisiblePortalProject(page);

        const projectHref = await page
          .locator('a[href^="/staff/projects/proj_"]')
          .first()
          .getAttribute("href");
        expect(
          projectHref,
          "Expected an RLS-visible project link.",
        ).toBeTruthy();

        const projectUrl = new URL(projectHref!, page.url());
        expect(
          projectUrl.origin,
          "Project link must remain on the tested portal origin.",
        ).toBe(new URL(page.url()).origin);
        expect(projectUrl.pathname).toMatch(
          /^\/staff\/projects\/proj_[a-zA-Z0-9_-]+$/,
        );

        await openPortalPage(page, `${projectUrl.pathname}?tab=activity`);

        const overview = page.locator('[data-project-overview-layout="true"]');
        await expect(overview).toBeVisible({ timeout: 60_000 });
        await expect(
          page.locator('[data-project-orientation="true"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-project-work-section="true"]'),
        ).toHaveCount(1);
        await expect(
          page.locator("[data-command-centre-source]"),
        ).toBeVisible();
        await expect(
          page.locator('[data-recent-notes-events="true"]'),
        ).toBeVisible();

        await expect(
          page.locator(
            '[data-overview-column="tasks"], [data-project-tasks-card="true"], [data-stage3-workstreams-slot]',
          ),
        ).toHaveCount(0);

        const prohibitedCallName = /\bcall\b/i;
        await expect(
          page.getByRole("link", { name: prohibitedCallName }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: prohibitedCallName }),
        ).toHaveCount(0);

        const siteVisitLinks = page.getByRole("link", {
          name: /\bsite visits?\b/i,
        });
        const siteVisitLinkCount = await siteVisitLinks.count();
        expect(
          siteVisitLinkCount,
          "Only the approved stage-gated Site Visit link may be present.",
        ).toBeLessThanOrEqual(1);
        if (siteVisitLinkCount === 1) {
          const projectId = projectUrl.pathname.split("/").at(-1)!;
          await expect(siteVisitLinks).toHaveAccessibleName(
            "Book or confirm site visit",
          );
          await expect(siteVisitLinks).toHaveAttribute(
            "href",
            `/staff/schedule?view=site-visits&project=${encodeURIComponent(projectId)}`,
          );
        }
        await expect(
          page.getByRole("button", { name: /\bsite visits?\b/i }),
        ).toHaveCount(0);
      },
    );
  } finally {
    expectNoProjectWorkMutationRequests(blockedMutations);
  }
});
