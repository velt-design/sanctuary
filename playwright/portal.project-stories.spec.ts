import { expect, test } from '@playwright/test';

const examples = [
  { key: 'enquiry', position: 'New enquiry', action: 'Reply to Aroha about her pergola enquiry', source: 'Can you help us cover our deck?' },
  { key: 'quote', position: 'Quote sent · decision outstanding', action: 'Follow up on Aroha’s quote decision', source: 'Thank you for the quote.' },
  { key: 'installation', position: 'Quote accepted', action: 'Confirm the installation week with Aroha', source: 'Please confirm the expected installation week' },
];

test('long correspondence does not separate work from commercial facts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/qa/project-command-centre-fixture?story=accepted-review');
  const work = page.locator('[data-project-overview-region="project-work"]');
  const commercial = page.locator('[data-project-overview-region="commercial"]');
  const emails = page.getByRole('region', { name: 'Customer conversations', exact: true });
  const checkGap = async () => {
    const top = await work.boundingBox();
    const bottom = await commercial.boundingBox();
    expect(bottom!.y - (top!.y + top!.height)).toBeGreaterThanOrEqual(0);
    expect(bottom!.y - (top!.y + top!.height)).toBeLessThanOrEqual(24);
  };
  await expect(commercial).toContainText('Current agreement:');
  // This history-review exception is expanded, unlike an ordinary agreement.
  await expect(commercial.locator('summary', { hasText: 'Quote & design details' })).toHaveCount(0);
  await expect(commercial.getByRole('link', { name: 'View quote history' })).not.toBeVisible();
  await commercial.locator('summary', { hasText: 'Quote history' }).click();
  await expect(commercial.getByRole('link', { name: 'View quote history' })).toHaveAttribute('href', /tab=quotes/);
  await commercial.locator('summary', { hasText: 'Quote history' }).click();
  await expect(emails.locator('article').first()).toContainText('From aroha@example.invalid');
  await checkGap();
  await emails.locator('article').first().getByText('Read message', { exact: true }).click();
  const history = emails.locator('article').first().locator('summary', { hasText: 'Earlier messages in this email' });
  await expect(history).toBeVisible();
  await expect(emails.getByText('Please find the revised design and price for your review.', { exact: false })).not.toBeVisible();
  await history.click();
  await expect(emails.locator('article').first().getByText('Subject: Your updated quote', { exact: false })).toBeVisible();
  await expect(emails.locator('article').first().getByText('Read message', { exact: true })).toBeVisible();
  await checkGap();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(emails.locator('article').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

for (const width of [1440, 390]) for (const example of examples) {
  test(`${example.key} tells one coherent story at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const writes: string[] = [];
    page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method()) && request.url().includes('/api/')) writes.push(request.url()); });
    await page.goto(`/qa/project-command-centre-fixture?story=${example.key}`);
    const work = page.getByRole('region', { name: 'Project Work', exact: true });
    await expect(work.getByRole('heading', { name: example.position, exact: true })).toBeVisible();
    if (example.key === 'installation') {
      await expect(work.getByRole('heading', { name: example.action, exact: true })).toBeVisible();
      await expect(work.locator('[data-primary-project-work]')).toHaveCount(1);
    } else {
      await expect(work.getByRole('heading', { name: example.action, exact: true })).toHaveCount(0);
      await expect(work.locator('[data-primary-project-work]')).toHaveCount(0);
      await expect(work).toContainText('Owner: Jordan');
    }
    await expect(work).not.toContainText('Review proposal progress');
    await expect(page.getByRole('button', { name: 'Edit details', exact: true })).toBeDisabled();
    const conversations = page.getByRole('region', { name: 'Customer conversations', exact: true });
    const incoming = conversations.locator('article blockquote:visible').filter({ hasText: example.source });
    await expect(incoming).toHaveCount(1);
    await expect(incoming).toBeVisible();
    await expect(conversations.locator('article a')).toHaveCount(0);
    await expect(conversations).toContainText('Your real Outlook emails are not connected');
    if (width === 1440) {
      const message = await incoming.boundingBox();
      expect(message!.y + message!.height).toBeLessThan(900);
    }
    await conversations.locator('summary', { hasText: 'AI interpretation and suggestions' }).click();
    const job = conversations.getByRole('region', { name: 'Job position', exact: true });
    await job.locator('summary').first().click();
    const evidence = job.locator('summary', { hasText: 'View supporting sources' });
    await evidence.focus();
    await page.keyboard.press('Enter');
    await expect(job.locator('blockquote')).toContainText(example.source);
    const suggestion = conversations.getByRole('region', { name: 'Suggested next step', exact: true });
    await expect(suggestion.locator('details').first()).not.toHaveAttribute('open', '');
    await suggestion.locator('summary').first().click();
    await expect(suggestion.locator('details').first()).toHaveAttribute('open', '');
    if (example.key === 'installation') {
      await expect(work).toContainText('Jordan');
      await expect(work.getByRole('button', { name: 'Mark complete' })).toBeDisabled();
      await expect(work).not.toContainText('Record email sent');
      // Recorded payments are useful first-layer facts, independent of quote detail.
      await expect(page.locator('summary', { hasText: 'Quote & design details' }).locator('..')).not.toHaveAttribute('open', '');
      await expect(page.getByRole('region', { name: 'Payment position', exact: true })).toContainText('$13,325.00');
    }
    await expect(work.getByRole('button', { name: /Record email sent|Record customer reply/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.locator('summary', { hasText: 'Contact, address & reference' }).click();
    await expect(page.getByRole('button', { name: 'Correct stage', exact: true })).toBeDisabled();
    expect(writes).toEqual([]);
  });
}
