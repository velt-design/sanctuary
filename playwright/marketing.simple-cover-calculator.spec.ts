import { expect, test, type Page } from '@playwright/test';

const route = '/simple-cover-calculator';
const viewports = [
  { name: 'large mobile', width: 430, height: 932 },
  { name: 'iPhone 15 Pro usable viewport', width: 393, height: 650 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact mobile', width: 360, height: 800 },
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
      connection: 'fascia' | 'facade' | 'soffit';
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

function prominentPrice(page: Page) {
  return page.viewportSize()!.width <= 560
    ? page.locator('[data-compact-price]')
    : page.locator('[data-result-price]');
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
    await expect(prominentPrice(page)).toHaveText(/From \$24,250/);
    await expect(page.getByText('GST and standard installation included.', { exact: true })).toBeVisible();
    await expect(page.getByText('Concept plan, not a construction drawing.', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Concept plan for a 6.0 m wide by 3.0 m projection pitched acrylic cover, 18.0 m², with a fascia connection and 3 posts.' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Connection' })).toHaveValue('fascia');

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
    await expect(page.locator('[data-plan-header]')).toContainText('18.0 m²');
    if (viewport.width <= 560) {
      await expect(page.locator('[data-compact-price]')).toBeVisible();
    } else {
      await expect(page.locator('[data-compact-price]')).toBeHidden();
    }
    await expect(page.locator('[data-plan-rafter]')).toHaveCount(11);
    await expect(page.locator('[data-plan-post]')).toHaveCount(3);

    const layout = await page.evaluate(() => {
      const calculator = document.querySelector<HTMLElement>('[data-simple-cover-calculator]');
      const controls = calculator?.querySelector<HTMLElement>('[data-calculator-controls]');
      const figure = calculator?.querySelector('figure');
      const secondary = calculator?.querySelector<HTMLElement>('[data-calculator-secondary-controls]');
      const stageShell = calculator?.querySelector<HTMLElement>('[data-calculator-stage-shell]');
      const controlBox = controls?.getBoundingClientRect();
      const figureBox = figure?.getBoundingClientRect();
      const secondaryBox = secondary?.getBoundingClientRect();
      const stageShellBox = stageShell?.getBoundingClientRect();
      const shortTargets = Array.from(calculator?.querySelectorAll<HTMLElement>('a, select, input[type="range"], [data-dimension-value]') ?? [])
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
        secondaryBox: secondaryBox ? { top: secondaryBox.top, right: secondaryBox.right, bottom: secondaryBox.bottom, left: secondaryBox.left } : null,
        stageShellBox: stageShellBox ? { top: stageShellBox.top, right: stageShellBox.right, bottom: stageShellBox.bottom, left: stageShellBox.left } : null,
        shortTargets,
      };
    });

    expect(layout.overflow).toBeLessThanOrEqual(0);
    expect(layout.calculatorWidth).toBeGreaterThan(0);
    expect(layout.shortTargets).toEqual([]);
    expect(layout.controlBox).not.toBeNull();
    expect(layout.figureBox).not.toBeNull();
    expect(layout.secondaryBox).not.toBeNull();
    expect(layout.stageShellBox).not.toBeNull();
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
    if (viewport.width <= 560) {
      expect(layout.figureBox!.bottom).toBeLessThanOrEqual(layout.controlBox!.top + 1);
      expect(layout.secondaryBox!.top).toBeGreaterThan(layout.controlBox!.bottom);
      expect(Math.abs(layout.secondaryBox!.top - layout.stageShellBox!.bottom)).toBeLessThanOrEqual(1);
    } else if (viewport.width <= 820) {
      expect(layout.figureBox!.top).toBeGreaterThanOrEqual(layout.controlBox!.bottom - 1);
    } else {
      expect(Math.abs(layout.figureBox!.top - layout.controlBox!.top)).toBeLessThanOrEqual(1);
      expect(layout.figureBox!.left).toBeGreaterThanOrEqual(layout.controlBox!.right - 1);
    }

    if (viewport.width <= 560) {
      await page.locator('[data-calculator-stage-shell]').evaluate((element) => {
        element.scrollIntoView({ block: 'start' });
      });

      const stageLayout = await page.evaluate(() => {
        const rect = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          const box = element?.getBoundingClientRect();
          return box ? { top: box.top, bottom: box.bottom, height: box.height } : null;
        };
        const sliderBoxes = Array.from(document.querySelectorAll<HTMLElement>('[data-calculator-mobile-stage] input[type="range"]'))
          .map((element) => {
            const box = element.getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, height: box.height };
          });
        const levelBoxes = Array.from(document.querySelectorAll<HTMLElement>('[data-calculator-level-control] input[type="radio"]'))
          .map((element) => {
            const box = element.closest('label')?.getBoundingClientRect();
            return box ? { top: box.top, bottom: box.bottom, height: box.height } : null;
          })
          .filter((box): box is { top: number; bottom: number; height: number } => box !== null);
        const stage = document.querySelector<HTMLElement>('[data-calculator-mobile-stage]');
        return {
          viewportHeight: window.innerHeight,
          header: rect('[data-header-ui="architectural-editorial"]'),
          stage: rect('[data-calculator-mobile-stage]'),
          composition: rect('[data-calculator-focus-composition]'),
          runway: rect('[data-calculator-focus-runway]'),
          plan: rect('[data-calculator-mobile-stage] figure'),
          controls: rect('[data-calculator-controls]'),
          level: rect('[data-calculator-level-control]'),
          result: rect('[data-result-state]'),
          stageResultCount: document.querySelectorAll('[data-calculator-mobile-stage] [data-result-state]').length,
          stageLevelCount: document.querySelectorAll('[data-calculator-mobile-stage] [data-calculator-level-control]').length,
          sliderBoxes,
          levelBoxes,
          stagePosition: stage ? getComputedStyle(stage).position : null,
          documentScrollSnap: getComputedStyle(document.documentElement).scrollSnapType,
          bodyScrollSnap: getComputedStyle(document.body).scrollSnapType,
        };
      });

      expect(stageLayout.header).not.toBeNull();
      expect(stageLayout.stage).not.toBeNull();
      expect(stageLayout.composition).not.toBeNull();
      expect(stageLayout.runway).not.toBeNull();
      expect(stageLayout.plan).not.toBeNull();
      expect(stageLayout.controls).not.toBeNull();
      expect(stageLayout.level).not.toBeNull();
      expect(stageLayout.result).not.toBeNull();
      expect(stageLayout.stagePosition).toBe('sticky');
      expect(stageLayout.documentScrollSnap).toBe('none');
      expect(stageLayout.bodyScrollSnap).toBe('none');
      expect(Math.abs(stageLayout.stage!.top - stageLayout.header!.bottom)).toBeLessThanOrEqual(2);
      expect(stageLayout.stage!.bottom).toBeLessThanOrEqual(stageLayout.viewportHeight + 1);
      expect(Math.abs(
        (stageLayout.composition!.top - stageLayout.stage!.top)
        - (stageLayout.stage!.bottom - stageLayout.composition!.bottom),
      )).toBeLessThanOrEqual(2);
      expect(stageLayout.plan!.top).toBeGreaterThanOrEqual(stageLayout.composition!.top - 1);
      expect(stageLayout.plan!.bottom).toBeLessThanOrEqual(stageLayout.controls!.top + 1);
      expect(stageLayout.controls!.bottom).toBeLessThanOrEqual(stageLayout.composition!.bottom + 1);
      expect(stageLayout.level!.top).toBeGreaterThanOrEqual(stageLayout.runway!.bottom - 1);
      expect(stageLayout.level!.bottom).toBeLessThanOrEqual(stageLayout.result!.top + 1);
      expect(stageLayout.stageResultCount).toBe(0);
      expect(stageLayout.stageLevelCount).toBe(0);
      expect(stageLayout.sliderBoxes).toHaveLength(2);
      expect(stageLayout.sliderBoxes.every((box) => box.height >= 60 && box.top >= stageLayout.stage!.top && box.bottom <= stageLayout.stage!.bottom)).toBe(true);
      expect(stageLayout.levelBoxes).toHaveLength(2);
      expect(stageLayout.levelBoxes.every((box) => box.height >= 72)).toBe(true);

      await page.evaluate(() => window.scrollBy(0, 64));
      const heldStageTop = await page.locator('[data-calculator-mobile-stage]').evaluate((element) => (
        element.getBoundingClientRect().top
      ));
      expect(Math.abs(heldStageTop - stageLayout.header!.bottom)).toBeLessThanOrEqual(2);
    }
  });
}

for (const viewport of [
  { name: 'short mobile', width: 360, height: 480 },
  { name: 'mobile landscape', width: 640, height: 360 },
  { name: '200 percent zoom equivalent', width: 195, height: 422 },
] as const) {
  test(`calculator keeps native scrolling at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepareCalculator(page);
    await page.goto(route);
    await expect(prominentPrice(page)).toHaveText(/From \$24,250/);

    const fallback = await page.evaluate(() => {
      const calculator = document.querySelector<HTMLElement>('[data-simple-cover-calculator]');
      const stage = calculator?.querySelector<HTMLElement>('[data-calculator-mobile-stage]');
      const plan = stage?.querySelector<HTMLElement>('figure');
      const controls = stage?.querySelector<HTMLElement>('[data-calculator-controls]');
      const level = calculator?.querySelector<HTMLElement>('[data-calculator-level-control]');
      const result = calculator?.querySelector<HTMLElement>('[data-result-state]');
      const planBox = plan?.getBoundingClientRect();
      const controlBox = controls?.getBoundingClientRect();
      const levelBox = level?.getBoundingClientRect();
      const resultBox = result?.getBoundingClientRect();
      return {
        overflow: document.body.scrollWidth - document.body.clientWidth,
        pageCanScroll: document.body.scrollHeight > window.innerHeight,
        stagePosition: stage ? getComputedStyle(stage).position : null,
        ordered: Boolean(
          planBox
          && controlBox
          && levelBox
          && resultBox
          && planBox.bottom <= controlBox.top + 1
          && controlBox.bottom <= levelBox.top + 1
          && levelBox.bottom <= resultBox.top + 1,
        ),
      };
    });

    expect(fallback.overflow).toBeLessThanOrEqual(0);
    expect(fallback.pageCanScroll).toBe(true);
    expect(fallback.stagePosition).not.toBe('sticky');
    expect(fallback.ordered).toBe(true);
  });
}

test('calculator handles post boundaries, custom limits and recovery without losing inputs', async ({ page }) => {
  const requests = { count: 0 };
  await page.setViewportSize({ width: 1024, height: 800 });
  await prepareCalculator(page, requests);
  await page.goto(route);
  await expect(prominentPrice(page)).toHaveText(/From \$24,250/);

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
  await expect(prominentPrice(page)).toHaveText(/From \$24,250/);
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
  await expect(prominentPrice(page)).toHaveText(/From \$24,250/);

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

  const connection = page.getByRole('combobox', { name: 'Connection' });
  await connection.selectOption('soffit');
  await expect(page.getByText('House / soffit edge', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /soffit-bracket connection/ })).toHaveAttribute('aria-label', /soffit-bracket connection/);
  await expect(prominentPrice(page)).toHaveText(/From \$24,250/);
});

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1366, height: 768 },
] as const) {
  test(`result panel stays stable across the Simple limit at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepareCalculator(page);
    await page.goto(route);
    await expect(prominentPrice(page)).toHaveText(/From \$24,250/);

    if (viewport.width <= 560) {
      await setRange(page, '#simple-cover-width', 6_100);
      await expect(page.locator('[data-compact-price-state="updating"]')).toContainText('From $24,250');
      await expect(page.locator('[data-compact-price-state="priced"]')).toContainText('From $24,250');
      await setRange(page, '#simple-cover-width', 6_000);
      await expect(page.locator('[data-compact-price-state="priced"]')).toContainText('From $24,250');
    }

    await setRange(page, '#simple-cover-projection', 5_100);
    const customCard = page.locator('[data-result-state="custom"]');
    await expect(customCard).toBeVisible();
    const customHeight = (await customCard.boundingBox())?.height ?? 0;

    await setRange(page, '#simple-cover-projection', 5_000);
    const loadingCard = page.locator('[data-result-state="loading"]');
    await expect(loadingCard).toBeVisible();
    if (viewport.width <= 560) {
      await expect(page.locator('[data-compact-price-state="loading"]')).toContainText('Calculating…');
    }
    const loadingHeight = (await loadingCard.boundingBox())?.height ?? 0;
    await expect(prominentPrice(page)).toHaveText(/From \$24,250/);
    const pricedHeight = (await page.locator('[data-result-state="priced"]').boundingBox())?.height ?? 0;

    expect(Math.abs(customHeight - loadingHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(pricedHeight - loadingHeight)).toBeLessThanOrEqual(1);
  });
}
