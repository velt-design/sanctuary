import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

export async function captureProjectCloseEvidence({
  page,
  layout,
  width,
  height,
  testInfo,
}: {
  page: Page;
  layout: Locator;
  width: number;
  height: number;
  testInfo: TestInfo;
}) {
  await layout.getByRole("button", { name: "Close project" }).click();
  const closeDialog = page.getByRole("dialog", { name: "Close project" });

  await expect(closeDialog).toBeVisible();
  await expect(closeDialog.getByRole("radio", { name: /^Lost/ })).not.toBeChecked();
  await expect(
    closeDialog.getByRole("radio", { name: /^Cancelled/ }),
  ).not.toBeChecked();
  await expect(
    closeDialog.getByRole("radio", { name: /^Complete/ }),
  ).not.toBeChecked();
  await expect(
    closeDialog.getByRole("button", { name: "Choose a close outcome" }),
  ).toBeDisabled();

  await closeDialog.getByText("Lost", { exact: true }).click();
  await expect(closeDialog.getByRole("radio", { name: /^Lost/ })).toBeChecked();
  await closeDialog.getByLabel("Lost outcome").selectOption("LOST_NO_RESPONSE");
  await expect(closeDialog.getByLabel("Additional note (optional)")).toBeVisible();
  await expect(closeDialog.getByLabel("Reason", { exact: true })).toHaveCount(0);
  await expect(
    closeDialog.getByRole("button", { name: "Close as Lost - No response" }),
  ).toBeEnabled();

  const closeBounds = await closeDialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { left: bounds.left, right: bounds.right };
  });
  expect(closeBounds.left).toBeGreaterThanOrEqual(-1);
  expect(closeBounds.right).toBeLessThanOrEqual(width + 1);

  await testInfo.attach(`project-close-${width}x${height}.png`, {
    body: await closeDialog.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
  await closeDialog.getByRole("button", { name: "Keep project open" }).click();
}
