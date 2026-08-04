import { expect, test, type Page } from '@playwright/test';

const route = '/simple-cover-calculator';
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'short laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1600, height: 1000 },
] as const;

function memberCentrePositions(widthMm: number, memberWidthMm: number, count: number) {
  const inset = memberWidthMm / 2 / widthMm;
  return Array.from({ length: count }, (_, index) => inset + index / (count - 1) * (1 - inset * 2));
}

async function prepareCalculator(page: Page, requestCounter?: { count: number }) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sp_consent_v1', JSON.stringify({
      analytics: false,
      marketing: false,
      updatedAt: new Date().toISOString(),
      version: 1,
    }));
  });
  await page.route('**/api/simple-cover-price', async (requestRoute) => {
    requestCounter && (requestCounter.count += 1);
    const input = requestRoute.request().postDataJSON() as {
      widthMm: number;
      projectionMm: number;
      level: 'ground' | 'elevated';
    };
    const areaM2 = input.widthMm * input.projectionMm / 1_000_000;
    const postCount = Math.max(2, Math.ceil(input.widthMm / 4_000) + 1);
    await requestRoute.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        status: 'priced',
        input,
        areaM2,
        postCount,
        postSpacingMm: Math.round(input.widthMm / (postCount - 1)),
        plan: {
          postPositions: memberCentrePositions(input.widthMm, 100, postCount),
          rafterPositions: memberCentrePositions(
            input.widthMm,
            50,
            Math.max(2, Math.ceil((input.widthMm - 50) / 642) + 1),
          ),
        },
        price: { fromIncGst: 24_250, currency: 'NZD' },
        configuration: { versionNumber: 23 },
      }),
    });
  });
}

async function setRange(page: Page, selector: string, value: number) {
  await page.locator(selector).evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, String(nextValue));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

for (const viewport of viewports) {
  test(`calculator remains complete and contained at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepareCalculator(page);
    await page.goto(route);

    await expect(page).toHaveTitle('Simple Cover Cost Calculator | Sanctuary Pergolas');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex, follow/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://www.sanctuarypergolas.co.nz/simple-cover-calculator',
    );
    await expect(page.getByRole('heading', { level: 1, name: 'Start with the footprint.' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Shape the cover. See the plan and price together.' })).toBeAttached();
    await expect(page.getByText('From $24,250', { exact: true })).toBeVisible();
    await expect(page.getByText('GST and standard installation included.', { exact: true })).toBeVisible();
    await expect(page.getByText('Concept plan, not a construction drawing.', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Concept plan for a 6.0 m wide by 3.0 m projection pitched acrylic cover, 18.0 m², with a fascia connection and 3 posts.' })).toBeVisible();

    const width = page.getByRole('slider', { name: 'Width along the house' });
    const projection = page.getByRole('slider', { name: 'Projection from the house' });
    await expect(width).toHaveAttribute('min', '1000');
    await expect(width).toHaveAttribute('max', '10000');
    await expect(width).toHaveAttribute('step', '100');
    await expect(projection).toHaveAttribute('min', '1000');
    await expect(projection).toHaveAttribute('max', '6000');
    await expect(projection).toHaveAttribute('step', '100');
    await expect(page.locator('[data-simple-cover-calculator] button')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Width along the house in metres' })).toHaveValue('6.0');
    await expect(page.locator('[data-plan-header]')).not.toContainText('18.0 m²');
    await expect(page.locator('[data-plan-rafter]')).toHaveCount(11);
    await expect(page.locator('[data-plan-post]')).toHaveCount(3);

    const layout = await page.evaluate(() => {
      const calculator = document.querySelector<HTMLElement>('[data-simple-cover-calculator]');
      const controls = calculator?.querySelector('form');
      const figure = calculator?.querySelector('figure');
      const controlBox = controls?.getBoundingClientRect();
      const figureBox = figure?.getBoundingClientRect();
      const shortTargets = Array.from(calculator?.querySelectorAll<HTMLElement>('a, input[type="range"], [data-dimension-value]') ?? [])
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width < 44 || box.height < 44;
        })
        .map((element) => element.getAttribute('aria-label') || element.textContent?.trim());
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        calculatorWidth: calculator?.getBoundingClientRect().width ?? 0,
        controlBox: controlBox ? { top: controlBox.top, right: controlBox.right, bottom: controlBox.bottom, left: controlBox.left } : null,
        figureBox: figureBox ? { top: figureBox.top, right: figureBox.right, bottom: figureBox.bottom, left: figureBox.left } : null,
        shortTargets,
      };
    });

    expect(layout.overflow).toBeLessThanOrEqual(0);
    expect(layout.calculatorWidth).toBeGreaterThan(0);
    expect(layout.shortTargets).toEqual([]);
    expect(layout.controlBox).not.toBeNull();
    expect(layout.figureBox).not.toBeNull();
    const structure = await page.evaluate(() => {
      const post = document.querySelector<HTMLElement>('[data-plan-post]');
      const rafter = document.querySelector<HTMLElement>('[data-plan-rafter]');
      const ledger = document.querySelector<HTMLElement>('[data-plan-ledger]');
      const beam = document.querySelector<HTMLElement>('[data-plan-front-beam]');
      const postBox = post?.getBoundingClientRect();
      const posts = Array.from(document.querySelectorAll<HTMLElement>('[data-plan-post]'));
      const rafters = Array.from(document.querySelectorAll<HTMLElement>('[data-plan-rafter]'));
      const firstPostBox = posts.at(0)?.getBoundingClientRect();
      const lastPostBox = posts.at(-1)?.getBoundingClientRect();
      const firstRafterBox = rafters.at(0)?.getBoundingClientRect();
      const lastRafterBox = rafters.at(-1)?.getBoundingClientRect();
      return {
        postIsSquare: postBox ? Math.abs(postBox.width - postBox.height) <= .5 : false,
        edgeFaceDelta: firstPostBox && lastPostBox && firstRafterBox && lastRafterBox
          ? [Math.abs(firstPostBox.left - firstRafterBox.left), Math.abs(lastPostBox.right - lastRafterBox.right)]
          : [],
        rafterEdges: rafter ? [getComputedStyle(rafter).borderLeftStyle, getComputedStyle(rafter).borderRightStyle] : [],
        ledgerEdges: ledger ? [getComputedStyle(ledger).borderTopStyle, getComputedStyle(ledger).borderBottomStyle] : [],
        beamEdges: beam ? [getComputedStyle(beam).borderTopStyle, getComputedStyle(beam).borderBottomStyle] : [],
      };
    });
    expect(structure.postIsSquare).toBe(true);
    expect(structure.edgeFaceDelta.every((delta) => delta <= 1)).toBe(true);
    expect(structure.rafterEdges).toEqual(['solid', 'solid']);
    expect(structure.ledgerEdges).toEqual(['solid', 'solid']);
    expect(structure.beamEdges).toEqual(['solid', 'solid']);
    if (viewport.width <= 820) {
      expect(layout.figureBox!.top).toBeGreaterThanOrEqual(layout.controlBox!.bottom - 1);
    } else {
      expect(Math.abs(layout.figureBox!.top - layout.controlBox!.top)).toBeLessThanOrEqual(1);
      expect(layout.figureBox!.left).toBeGreaterThanOrEqual(layout.controlBox!.right - 1);
    }
  });
}

test('calculator handles post boundaries, custom limits and recovery without losing inputs', async ({ page }) => {
  const requests = { count: 0 };
  await page.setViewportSize({ width: 1024, height: 800 });
  await prepareCalculator(page, requests);
  await page.goto(route);
  await expect(page.getByText('From $24,250', { exact: true })).toBeVisible();

  await setRange(page, '#simple-cover-width', 4_000);
  await expect(page.getByText(/2 posts · max 4 m · rafters/)).toBeVisible();
  await setRange(page, '#simple-cover-width', 4_100);
  await expect(page.getByText(/3 posts · max 4 m · rafters/)).toBeVisible();

  await page.locator('label').filter({ hasText: 'Elevated / first floor' }).click();
  await setRange(page, '#simple-cover-width', 6_000);
  await setRange(page, '#simple-cover-projection', 3_400);

  await expect(page.getByText('20.4 m² exceeds the 20 m² elevated Simple cover limit.', { exact: true })).toBeVisible();
  await expect(page.getByText('From $24,250', { exact: true })).toHaveCount(0);
  await expect(page.locator('#simple-cover-width')).toHaveValue('6000');
  await expect(page.locator('#simple-cover-projection')).toHaveValue('3400');
  await expect(page.getByRole('link', { name: 'Discuss a custom design' })).toHaveAttribute('href', /source_component=public_calculator/);
  const requestsAtCustom = requests.count;
  await page.waitForTimeout(250);
  expect(requests.count).toBe(requestsAtCustom);

  await setRange(page, '#simple-cover-projection', 3_300);
  await expect(page.getByText('From $24,250', { exact: true })).toBeVisible();
  expect(requests.count).toBeGreaterThan(requestsAtCustom);

  await setRange(page, '#simple-cover-width', 10_000);
  await setRange(page, '#simple-cover-projection', 1_000);
  await expect(page.getByText('Roof fall', { exact: true })).toBeHidden();
  await expect.poll(async () => {
    const box = await page.locator('[data-plan-footprint]').boundingBox();
    return box ? box.width / box.height : 0;
  }).toBeCloseTo(10, 2);

  await setRange(page, '#simple-cover-width', 1_000);
  await setRange(page, '#simple-cover-projection', 6_000);
  await expect.poll(async () => {
    const box = await page.locator('[data-plan-footprint]').boundingBox();
    return box ? box.width / box.height : 0;
  }).toBeCloseTo(1 / 6, 2);
});

test('calculator exposes visible keyboard focus and live output semantics', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareCalculator(page);
  await page.goto(route);
  await expect(page.getByText('From $24,250', { exact: true })).toBeVisible();

  const calculator = page.locator('[data-simple-cover-calculator]');
  await expect(calculator.locator('[aria-live="polite"]')).toHaveCount(1);
  const widthMetres = page.getByRole('textbox', { name: 'Width along the house in metres' });
  await widthMetres.focus();
  await expect(widthMetres).toBeFocused();
  const focusedValue = await widthMetres.evaluate((element) => ({
    selectionStart: (element as HTMLInputElement).selectionStart,
    selectionEnd: (element as HTMLInputElement).selectionEnd,
    valueLength: (element as HTMLInputElement).value.length,
    borderWidth: getComputedStyle(element.parentElement!).borderTopWidth,
    borderStyle: getComputedStyle(element.parentElement!).borderTopStyle,
    selectionBackground: getComputedStyle(element, '::selection').backgroundColor,
    selectionColor: getComputedStyle(element, '::selection').color,
  }));
  expect(focusedValue).toMatchObject({ selectionStart: 0, selectionEnd: 3, valueLength: 3, borderWidth: '1px', borderStyle: 'solid' });
  expect(focusedValue.selectionBackground).toBe('rgb(17, 18, 16)');
  expect(focusedValue.selectionColor).not.toBe(focusedValue.selectionBackground);
  await widthMetres.fill('6.14');
  await widthMetres.press('Enter');
  await expect(page.locator('#simple-cover-width')).toHaveValue('6100');
  await expect(widthMetres).toHaveValue('6.1');
  await expect(page.getByText('18.3 m²', { exact: true })).toHaveCount(2);
});
