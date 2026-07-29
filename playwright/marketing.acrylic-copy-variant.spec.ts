import { expect, test } from '@playwright/test';

const retiredRoute = '/acrylic-roof-pergolas-auckland-v2';
const canonicalRoute = '/acrylic-roof-pergolas-auckland';

test('the retired acrylic copy variant redirects to the canonical page in one hop', async ({
  request,
}) => {
  const response = await request.get(retiredRoute, { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe(canonicalRoute);
});

test('the canonical acrylic page remains indexable and self-canonical', async ({
  page,
}) => {
  const response = await page.goto(canonicalRoute);
  expect(response?.ok()).toBe(true);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `https://www.sanctuarypergolas.co.nz${canonicalRoute}`,
  );
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
    'content',
    /noindex/i,
  );
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Acrylic roof pergolas for Auckland homes.',
  })).toBeVisible();
});
