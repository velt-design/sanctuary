import { expect, test } from "@playwright/test";

import {
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
import { WORK_QUEUE_PAGE_SIZE } from "../apps/portal/components/projects/workQueue/workQueuePagination";

interface WorkQueueResponse {
  entries: unknown[];
  generatedAt: string;
}

test.use({ serviceWorkers: "block" });

test("authenticated Work Queue is ready through its read-only route", async ({
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
      { phase: "project-work-queue-readonly-auth" },
      async () => {
        const queueResponsePromise = page.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            response.request().method() === "GET"
            && url.pathname === "/api/staff/v1/work-items/queue"
          );
        });

        await openPortalPage(page, "/staff/projects/work-queue", {
          heading: "Work Queue",
        });

        const queueResponse = await queueResponsePromise;
        expect(queueResponse.status()).toBe(200);
        expect(queueResponse.headers()["cache-control"]).toContain("private");
        expect(queueResponse.headers()["cache-control"]).toContain("no-store");
        expect(new URL(queueResponse.url()).origin).toBe(
          new URL(page.url()).origin,
        );

        const payload = (await queueResponse.json()) as WorkQueueResponse;
        expect(Array.isArray(payload.entries)).toBe(true);
        expect(payload.generatedAt).toBeTruthy();

        await expect(
          page.locator('[data-project-work-queue-state="fresh"]'),
        ).toBeVisible({ timeout: 60_000 });
        await expect(
          page.getByText("Work Queue not ready", { exact: true }),
        ).toHaveCount(0);

        const staleReview = page.getByRole("region", {
          name: "Stale enquiry review",
        });
        if (process.env.PORTAL_TEST_ROLE?.trim() === "admin") {
          await expect(staleReview).toBeVisible();
          await expect(staleReview).toContainText("Nothing closes automatically");
          await staleReview
            .getByRole("button", { name: "Review exact list" })
            .click();
          const reviewDialog = page.getByRole("dialog", {
            name: "Review stale enquiries",
          });
          await expect(reviewDialog).toBeVisible();
          await expect(reviewDialog).toContainText(
            "None are selected by default",
          );
          const candidateCheckboxes = reviewDialog.getByRole("checkbox");
          for (
            let index = 0;
            index < (await candidateCheckboxes.count());
            index += 1
          ) {
            await expect(candidateCheckboxes.nth(index)).not.toBeChecked();
          }
          await expect(
            reviewDialog.getByRole("button", { name: "Review selected (0)" }),
          ).toBeDisabled();
          await reviewDialog.getByRole("button", { name: "Cancel" }).click();
        } else {
          await expect(staleReview).toHaveCount(0);
        }

        const queueRows = page.locator(
          "li[data-queue-group][data-action-kind]",
        );
        const validEmptyState = page.getByRole("heading", {
          name: "No current project work",
          exact: true,
        });

        if (payload.entries.length === 0) {
          await expect(queueRows).toHaveCount(0);
          await expect(validEmptyState).toBeVisible();
        } else {
          await expect(queueRows).toHaveCount(
            Math.min(payload.entries.length, WORK_QUEUE_PAGE_SIZE),
          );
          await expect(validEmptyState).toHaveCount(0);

          if (payload.entries.length > WORK_QUEUE_PAGE_SIZE) {
            await page.getByRole("button", { name: "Next page" }).click();
            await expect(queueRows).toHaveCount(
              Math.min(
                payload.entries.length - WORK_QUEUE_PAGE_SIZE,
                WORK_QUEUE_PAGE_SIZE,
              ),
            );
          }
        }
      },
    );
  } finally {
    expectNoProjectWorkMutationRequests(blockedMutations);
  }
});
