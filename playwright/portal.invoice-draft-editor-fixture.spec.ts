import { expect, test } from '@playwright/test';

test('invoice draft editing stays usable at desktop and mobile widths', async ({ page }) => {
  const commands: Array<Record<string, any>> = [];
  await page.route('**/api/admin/projects/*/invoice-drafts', async (route) => {
    const body = route.request().postDataJSON(); commands.push(body);
    if (body.action === 'save') {
      await route.fulfill({ json: { draft: { id: body.invoiceId, projectId: 'proj_10000000-0000-4000-8000-000000000001',
        quoteVersionId: body.quoteVersionId, revision: body.expectedRevision + 1, content: body.content,
        options: body.options, scopeTotalIncGstCents: 115000, amountIncGstCents: body.options.amountIncGstCents } } });
    } else await route.fulfill({ json: { issued: true, invoiceRef: 'INV-FIXTURE', sendError: 'Synthetic provider failure' } });
  });
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/qa/invoice-draft-editor-fixture');
    await page.getByRole('button', { name: 'Open quote-linked draft' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Quoted scope — reference', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Quantity', { exact: true })).toHaveAttribute('readonly', '');
    await expect(dialog.getByLabel('Unit price incl GST', { exact: true })).toHaveAttribute('readonly', '');
    await dialog.getByLabel('Invoice notes', { exact: true }).fill('Saved synthetic note');
    await expect(dialog.getByRole('button', { name: 'Issue invoice', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Issue invoice', exact: true })).toBeEnabled();
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `../../output/invoice-draft-editor-${viewport.width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Issue and send', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Synthetic provider failure' })).toBeVisible();
    await page.getByRole('button', { name: 'Open standalone draft' }).click();
    await dialog.getByRole('button', { name: 'Add item', exact: true }).click();
    await expect(dialog.getByLabel('Item 2 description')).toBeVisible();
    await expect(dialog.getByLabel('Quantity', { exact: true }).first()).not.toHaveAttribute('readonly', '');
    await dialog.getByRole('button', { name: 'Discard unsaved changes', exact: true }).click();
  }
  expect(commands.filter((command) => command.action === 'issue')).toHaveLength(2);
});
