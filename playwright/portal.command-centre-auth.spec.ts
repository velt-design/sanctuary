import { expect, test } from "@playwright/test";
import {
  openPortalPage,
  withPortalBrowserEvidence,
} from "./support/portalAgent";

test.describe.configure({ mode: "serial" });

const mutationProjectId =
  process.env.PORTAL_COMMAND_CENTRE_MUTATION_PROJECT_ID?.trim();
const conflictProjectId =
  process.env.PORTAL_COMMAND_CENTRE_CONFLICT_PROJECT_ID?.trim();

function futureYmd(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

const actionCommandUrl = (projectId: string) =>
  `/api/staff/v1/projects/${encodeURIComponent(projectId)}/command-centre/primary-action/commands`;

test("authenticated real project renders the integrated command centre and nested commercial relationships", async ({
  page,
}, testInfo) => {
  await withPortalBrowserEvidence(
    page,
    testInfo,
    { phase: "command-centre-auth" },
    async () => {
      await openPortalPage(page, "/staff/projects", { heading: "Projects" });
      const href = await page
        .locator('a[href^="/staff/projects/proj_"]')
        .first()
        .getAttribute("href");
      expect(
        href,
        "The authenticated Stage 2 gate requires at least one RLS-visible real project.",
      ).toBeTruthy();

      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/staff/v1/projects/") &&
          response.url().endsWith("/command-centre"),
      );
      await openPortalPage(page, `${href!.split("?")[0]}?tab=activity`);
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toContain("private");
      expect(response.headers()["cache-control"]).toContain("no-store");

      const payload = (await response.json()) as {
        workModel?: "legacy" | "v2";
        currentDesign?: {
          source?: string;
          estimate?: unknown;
          quote?: unknown;
          price?: unknown;
        };
        operations?: {
          owner?: unknown;
          candidates?: unknown[];
          audit?: unknown[];
        };
        owner?: unknown;
        projectWork?: {
          primaryAction?: unknown;
          openItems?: unknown[];
          blockedItems?: unknown[];
        };
      };
      expect(payload.currentDesign?.source).toBeTruthy();
      expect(payload.currentDesign).toHaveProperty("estimate");
      expect(payload.currentDesign).toHaveProperty("quote");
      expect(payload.currentDesign).toHaveProperty("price");
      if (payload.workModel === "v2") {
        expect(payload.owner).toBeTruthy();
        expect(payload.projectWork?.primaryAction).toBeTruthy();
        expect(Array.isArray(payload.projectWork?.openItems)).toBe(true);
        expect(Array.isArray(payload.projectWork?.blockedItems)).toBe(true);
      } else {
        expect(payload.operations?.owner).toBeTruthy();
        expect(Array.isArray(payload.operations?.candidates)).toBe(true);
        expect(Array.isArray(payload.operations?.audit)).toBe(true);
      }

      await expect(
        page.locator('[data-project-work-section="true"]'),
      ).toBeVisible();
      await expect(page.locator("[data-project-owner]").first()).toBeVisible();

      const dashboardResponsePromise = page.waitForResponse((candidate) =>
        candidate.url().includes("/api/dashboard?queue="),
      );
      await openPortalPage(page, "/dashboard", { heading: "Dashboard" });
      const dashboardResponse = await dashboardResponsePromise;
      expect(dashboardResponse.status()).toBe(200);
      expect(dashboardResponse.headers()["cache-control"]).toContain("private");
      expect(dashboardResponse.headers()["cache-control"]).toContain(
        "no-store",
      );
      await expect(
        page.getByRole("heading", { name: "Work Queue" }),
      ).toBeVisible();
    },
  );
});

test("authenticated dedicated project completes the owner and primary-action mutation lifecycle", async ({
  page,
}, testInfo) => {
  expect(
    mutationProjectId,
    "Set PORTAL_COMMAND_CENTRE_MUTATION_PROJECT_ID to an active new-through-sent test project with no open dated actions or conflict.",
  ).toBeTruthy();
  const projectId = mutationProjectId!;

  await withPortalBrowserEvidence(
    page,
    testInfo,
    { phase: "command-centre-auth-mutations" },
    async () => {
      await openPortalPage(page, `/staff/projects/${projectId}?tab=activity`);
      await expect(
        page.locator('[data-primary-action-card="true"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-primary-action-state="empty"]'),
        "The dedicated mutation project must start without another qualifying primary action.",
      ).toBeVisible();

      await page.getByRole("button", { name: "Manage project owner" }).click();
      const projectOwnerSelect = page.getByLabel("Change project owner");
      await expect(
        projectOwnerSelect,
        "The authenticated owner mutation gate requires an admin test account.",
      ).toBeVisible();
      const original = await projectOwnerSelect.inputValue();
      const options = await projectOwnerSelect
        .locator("option")
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            value: (node as HTMLOptionElement).value,
            disabled: (node as HTMLOptionElement).disabled,
          })),
        );
      const target = options.find(
        (option) =>
          !option.disabled && option.value && option.value !== original,
      )?.value;
      expect(
        target,
        "The owner gate requires another value from Jordan, JP, Joe, or Bruce.",
      ).toBeDefined();
      const ownerResponsePromise = page.waitForResponse((response) =>
        response.url().includes("/command-centre/owners"),
      );
      await projectOwnerSelect.selectOption(target!);
      const ownerResponse = await ownerResponsePromise;
      expect(ownerResponse.status()).toBe(200);
      expect(ownerResponse.headers()["cache-control"]).toContain("no-store");

      await page.getByRole("button", { name: "Manage next action" }).click();
      const title = `Stage 2 authenticated ${Date.now()}`;
      await page.getByLabel("Action title").fill(title);
      await page.getByLabel("Category").selectOption("Follow-up");
      await page.getByLabel("Due date", { exact: true }).fill(futureYmd(7));
      let responsePromise = page.waitForResponse((response) =>
        response.url().endsWith(actionCommandUrl(projectId)),
      );
      await page.getByRole("button", { name: "Create and select" }).click();
      expect((await responsePromise).status()).toBe(200);
      await expect(page.getByRole("heading", { name: title })).toBeVisible();

      await page.getByLabel("New due date").fill(futureYmd(8));
      responsePromise = page.waitForResponse((response) =>
        response.url().endsWith(actionCommandUrl(projectId)),
      );
      await page.getByRole("button", { name: "Reschedule" }).click();
      expect((await responsePromise).status()).toBe(200);

      const ownerSelect = page.getByLabel("Action owner");
      const currentOwner = await ownerSelect.inputValue();
      const ownerOptions = await ownerSelect
        .locator("option")
        .evaluateAll((nodes) =>
          nodes
            .map((node) => node as HTMLOptionElement)
            .filter((node) => !node.disabled)
            .map((node) => node.value),
        );
      const actionOwner =
        ownerOptions.find((value) => value && value !== currentOwner) ??
        (currentOwner ? "" : ownerOptions.find(Boolean));
      expect(
        actionOwner,
        "The action reassignment gate needs another active staff member or an assigned current owner.",
      ).not.toBeUndefined();
      await ownerSelect.selectOption(actionOwner!);
      responsePromise = page.waitForResponse((response) =>
        response.url().endsWith(actionCommandUrl(projectId)),
      );
      await page.getByRole("button", { name: "Reassign" }).click();
      expect((await responsePromise).status()).toBe(200);

      let mockedCommands = 0;
      await page.route(`**${actionCommandUrl(projectId)}`, async (route) => {
        mockedCommands += 1;
        const command = route.request().postDataJSON() as { commandId: string };
        await route.fulfill({
          status: 200,
          headers: {
            "cache-control": "private, no-store",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            command: { id: command.commandId, committed: true },
            refreshRequired: true,
          }),
        });
      });
      await page
        .getByLabel("Criticality reason")
        .fill("Authenticated refresh-failure verification");
      await page.getByRole("button", { name: "Mark critical" }).click();
      await expect(
        page.getByText(
          "Saved on the server. Refreshing the Overview to load the confirmed state.",
        ),
      ).toBeVisible();
      expect(mockedCommands).toBe(1);
      await page.unroute(`**${actionCommandUrl(projectId)}`);

      await page
        .getByLabel("Criticality reason")
        .fill("Authenticated critical-action verification");
      responsePromise = page.waitForResponse((response) =>
        response.url().endsWith(actionCommandUrl(projectId)),
      );
      await page.getByRole("button", { name: "Mark critical" }).click();
      expect((await responsePromise).status()).toBe(200);
      await expect(
        page.getByText("Critical: Authenticated critical-action verification"),
      ).toBeVisible();

      await page.getByLabel("Select open work").selectOption({ label: title });
      responsePromise = page.waitForResponse((response) =>
        response.url().endsWith(actionCommandUrl(projectId)),
      );
      await page.getByRole("button", { name: "Make primary" }).click();
      expect((await responsePromise).status()).toBe(200);

      responsePromise = page.waitForResponse((response) =>
        response.url().endsWith(actionCommandUrl(projectId)),
      );
      await page.getByRole("button", { name: "Complete" }).click();
      expect((await responsePromise).status()).toBe(200);
      await expect(
        page.locator('[data-primary-action-state="empty"]'),
      ).toBeVisible();
      await expect(
        page.getByText("Legacy command history", { exact: true }),
      ).toBeVisible();

      await openPortalPage(page, "/dashboard", { heading: "Dashboard" });
      await expect(
        page.getByRole("heading", { name: "Work Queue" }),
      ).toBeVisible();
    },
  );
});

test("authenticated admin resolves a real conflict and the project boundary handles access ending", async ({
  page,
}, testInfo) => {
  expect(
    conflictProjectId,
    "Set PORTAL_COMMAND_CENTRE_CONFLICT_PROJECT_ID to a dedicated active project with a current explicit-selection conflict; use an admin test account.",
  ).toBeTruthy();
  const projectId = conflictProjectId!;

  await withPortalBrowserEvidence(
    page,
    testInfo,
    { phase: "command-centre-auth-conflict" },
    async () => {
      await openPortalPage(page, `/staff/projects/${projectId}?tab=activity`);
      await expect(page.locator('[data-action-conflict="true"]')).toBeVisible();
      const responsePromise = page.waitForResponse((response) =>
        response.url().endsWith(actionCommandUrl(projectId)),
      );
      await page.getByRole("button", { name: "Use selected action" }).click();
      expect((await responsePromise).status()).toBe(200);
      await expect(page.locator('[data-action-conflict="true"]')).toHaveCount(
        0,
      );

      const commandCentrePattern = `**/api/staff/v1/projects/${projectId}/command-centre`;
      await page.route(commandCentrePattern, (route) =>
        route.fulfill({
          status: 403,
          headers: {
            "cache-control": "private, no-store",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            error: "Project access is no longer available.",
          }),
        }),
      );
      await page.reload();
      await expect(
        page.getByText("Project access is no longer available."),
      ).toBeVisible();
      await page.unroute(commandCentrePattern);
    },
  );
});
