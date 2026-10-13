import { expect, test } from "@playwright/test";
import type { ProjectsIndexResponse } from "../apps/portal/lib/projects/projectsIndexContract";

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

        await openPortalPage(page, "/staff/projects", { heading: "Projects", headingLevel: 1 });
        const projectsResponse = await projectsResponsePromise;
        expectPrivateNoStore(projectsResponse);
        await expect(
          page.locator('[data-projects-index-state="fresh"]'),
        ).toBeVisible({ timeout: 60_000 });
        await expectVisiblePortalProject(page);

        const projectsTable = page.getByRole("table", { name: "Projects" });
        await expect(projectsTable.getByRole("columnheader")).toHaveText([
          "Project", "Stage", "Time in stage", "Next action", "Owner", "Actions",
        ]);
        const firstProjectRow = projectsTable.getByRole("row").nth(1);
        await expect(firstProjectRow.locator('[data-column="Stage"]'))
          .not.toHaveText("");
        const projects = await projectsResponse.json() as ProjectsIndexResponse;
        expect(projects.projects.rows.length).toBeGreaterThan(0);
        for (const project of projects.projects.rows) {
          expect(["ACTIVE", "WAITING", "CLOSED", "ARCHIVED"]).toContain(project.effectiveState);
        }
        await page.getByRole("button", { name: /^Filters/ }).click();
        for (const label of ["Journey", "Stage", "State"]) {
          await expect(page.getByRole("combobox", { name: label, exact: true })).toBeVisible();
        }
        await page.getByRole("button", { name: "Cancel", exact: true }).click();

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
        const projectsResponsePromise = page.waitForResponse((response) =>
          response.request().method() === "GET"
          && new URL(response.url()).pathname === "/api/staff/v1/projects/index",
        );
        await openPortalPage(page, "/staff/projects", { heading: "Projects", headingLevel: 1 });
        const projectsResponse = await projectsResponsePromise;
        expectPrivateNoStore(projectsResponse);
        await expect(page.locator('[data-projects-index-state="fresh"]')).toBeVisible({ timeout: 60_000 });
        await expectVisiblePortalProject(page);

        const projectsTable = page.getByRole("table", { name: "Projects" });
        const projects = await projectsResponse.json() as ProjectsIndexResponse;
        const activeProject = projects.projects.rows.find((project) => project.effectiveState === "ACTIVE");
        expect(activeProject, "Expected an RLS-visible Active project on the current page.").toBeTruthy();
        const activeProjectRow = projectsTable
          .locator(`[data-project-index-anchor="${activeProject!.id}"]`);
        await expect(activeProjectRow).toBeVisible();
        const projectHref = await activeProjectRow
          .locator('a[data-project-open]')
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
        const commercialSource = overview.locator("[data-command-centre-source]");
        await expect(commercialSource).toBeAttached();
        if (!await commercialSource.isVisible()) {
          await overview.locator("summary").filter({ hasText: "Quote & design details" }).click();
        }
        await expect(
          commercialSource,
        ).toBeVisible();
        await overview.locator("summary").filter({ hasText: "Team notes & portal history" }).click();
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

        await overview.getByRole("button", { name: "Manage project work", exact: true }).click();
        await overview.getByRole("button", { name: "Close project", exact: true }).click();
        const closeDialog = page.getByRole("dialog", {
          name: "Close project",
        });
        await expect(closeDialog).toBeVisible();
        await expect(
          closeDialog.getByRole("radio", { name: /^Lost/ }),
        ).not.toBeChecked();
        await expect(
          closeDialog.getByRole("radio", { name: /^Cancelled/ }),
        ).not.toBeChecked();
        await expect(
          closeDialog.getByRole("radio", { name: /^Close settled project/ }),
        ).not.toBeChecked();
        await expect(closeDialog.getByText("What will happen")).toBeVisible();
        await expect(
          closeDialog.getByRole("button", { name: "Choose a close outcome" }),
        ).toBeDisabled();
        await closeDialog
          .getByRole("button", { name: "Keep project open" })
          .click();
      },
    );
  } finally {
    expectNoProjectWorkMutationRequests(blockedMutations);
  }
});
