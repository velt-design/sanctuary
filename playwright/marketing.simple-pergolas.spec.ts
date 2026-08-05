import { expect, test, type Browser, type Page } from '@playwright/test';

const route = '/simple-pergolas-auckland';
const publicOrigin = 'https://www.sanctuarypergolas.co.nz';
const calculationRef = 'sc1.playwright-opaque-reference';
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'short mobile', width: 393, height: 650 },
] as const;

type PriceApiStatus = 'priced' | 'unavailable';

function memberCentrePositions(widthMm: number, memberWidthMm: number, count: number) {
  const inset = memberWidthMm / 2 / widthMm;
  return Array.from(
    { length: count },
    (_, index) => inset + index / (count - 1) * (1 - inset * 2),
  );
}

async function preparePage(
  page: Page,
  options: { analytics?: boolean; priceStatus?: PriceApiStatus } = {},
) {
  const analytics = options.analytics ?? false;
  await page.addInitScript((analyticsEnabled) => {
    window.localStorage.setItem('sp_consent_v1', JSON.stringify({
      analytics: analyticsEnabled,
      marketing: false,
      updatedAt: new Date().toISOString(),
      version: 1,
    }));
  }, analytics);

  await page.route('**/api/simple-cover-price', async (requestRoute) => {
    if (options.priceStatus === 'unavailable') {
      await requestRoute.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          status: 'unavailable',
          message: 'Live pricing is temporarily unavailable. Your selections are still here.',
        }),
      });
      return;
    }

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
        calculationRef,
      }),
    });
  });
}

async function setRange(page: Page, accessibleName: string, value: number) {
  await page.getByRole('slider', { name: accessibleName }).evaluate(
    (element, nextValue) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, String(nextValue));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    value,
  );
}

for (const viewport of viewports) {
  test(`calculator-led Simple page is contained at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);
    await page.goto(route);

    await expect(page).toHaveTitle('Simple Pitched Acrylic Pergolas | Sanctuary Pergolas');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /follow/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${publicOrigin}${route}`,
    );
    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Cover the space without losing light.',
    })).toBeVisible();
    await expect(page.locator('main > section').first().getByRole('link', {
      name: 'Price your Simple cover',
      exact: true,
    })).toBeVisible();

    const calculatorSection = page.locator('#price-your-cover');
    await expect(calculatorSection).toHaveAttribute(
      'data-simple-price-integration',
      'full-calculator',
    );
    await expect(calculatorSection.locator('[data-simple-cover-calculator]')).toHaveAttribute(
      'data-placement',
      'embedded',
    );
    if (viewport.width <= 560) {
      await expect(page.getByRole('heading', {
        name: 'Price your Simple cover.',
        exact: true,
      })).toBeVisible();
      await expect(calculatorSection.locator('header > p')).toBeHidden();
    } else {
      await expect(page.getByRole('heading', {
        name: 'Set the footprint. See the installed estimate.',
        exact: true,
      })).toBeVisible();
      await expect(calculatorSection.locator('header > p')).toBeVisible();
    }
    await expect(page.locator('[data-result-price]')).toHaveText('From $24,250');
    await expect(page.getByText('Concept plan, not a construction drawing.', {
      exact: true,
    })).toBeAttached();
    await expect(page.getByText(/max 4 m/)).toBeAttached();

    expect(await calculatorSection.evaluate((section) => (
      section.previousElementSibling?.matches('main > section:first-child') ?? false
    ))).toBe(true);
    const levelComparison = page.locator('section[aria-labelledby="simple-level-comparison-title"]');
    await expect(levelComparison.getByRole('heading', {
      name: 'Ground level or elevated.',
      exact: true,
    })).toBeVisible();
    await expect(levelComparison.getByRole('img')).toHaveCount(2);
    const comparisonCards = await levelComparison.locator('figure').evaluateAll((cards) => (
      cards.map((card) => {
        const box = card.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      })
    ));
    if (viewport.width <= 720) {
      expect(comparisonCards[1].y).toBeGreaterThan(comparisonCards[0].y);
      expect(Math.abs(comparisonCards[0].height - comparisonCards[1].height)).toBeLessThanOrEqual(2);
    } else {
      expect(Math.abs(comparisonCards[0].y - comparisonCards[1].y)).toBeLessThanOrEqual(2);
      expect(comparisonCards[1].x).toBeGreaterThan(comparisonCards[0].x);
    }
    expect(await levelComparison.evaluate((section) => (
      section.previousElementSibling?.id === 'price-your-cover'
    ))).toBe(true);
    await expect(page.locator('[data-simple-price-integration="fit-section"]')).toHaveCount(0);
    await expect(page.getByRole('heading', {
      name: 'Clear limits make the first decision easy.',
    })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Simple form. Sanctuary finish.' })).toBeAttached();
    const standard = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Simple form. Sanctuary finish.' }),
    });
    await expect(standard.locator('ol > li')).toHaveCount(3);
    const inclusionsHeading = standard.getByText('Included in the proposal', { exact: true });
    if (viewport.width <= 720) {
      await expect(inclusionsHeading).toBeHidden();
    } else {
      await expect(inclusionsHeading).toBeVisible();
    }
    await expect(page.getByText('Optional blinds', { exact: true })).toBeAttached();
    const options = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Make it suit the home.' }),
    });
    await expect(options.locator('article')).toHaveCount(3);
    await expect(page.getByText('Rob Ebert', { exact: true })).toBeAttached();
    await expect(page.getByText('Pierre and Tracy', { exact: true })).toBeAttached();
    await expect(page.getByRole('link', {
      name: '5.0 out of 5 from 61 Google reviews',
      exact: true,
    })).toBeVisible();
    await expect(page.getByText('Google review', { exact: true })).toHaveCount(2);
    const reviews = page.locator('section[aria-labelledby="simple-reviews-title"]');
    const reviewHeadingBox = await reviews.getByRole('heading', {
      name: 'Thoughtful work, clearly delivered.',
      exact: true,
    }).boundingBox();
    const googleTrustBox = await reviews.getByRole('link', {
      name: '5.0 out of 5 from 61 Google reviews',
      exact: true,
    }).boundingBox();
    expect(reviewHeadingBox).not.toBeNull();
    expect(googleTrustBox).not.toBeNull();
    if (viewport.width <= 900) {
      expect(googleTrustBox!.y).toBeGreaterThan(reviewHeadingBox!.y + reviewHeadingBox!.height);
    } else {
      expect(googleTrustBox!.x).toBeGreaterThan(reviewHeadingBox!.x + reviewHeadingBox!.width);
    }
    const reviewCards = await reviews.locator('figure').evaluateAll((cards) => (
      cards.map((card) => {
        const box = card.getBoundingClientRect();
        return { x: box.x, y: box.y };
      })
    ));
    if (viewport.width <= 720) {
      expect(reviewCards[1].y).toBeGreaterThan(reviewCards[0].y);
    } else {
      expect(Math.abs(reviewCards[0].y - reviewCards[1].y)).toBeLessThanOrEqual(2);
      expect(reviewCards[1].x).toBeGreaterThan(reviewCards[0].x);
    }
    const boundary = page.locator('section').filter({
      has: page.getByRole('heading', {
        name: 'Simple or Custom?',
      }),
    });
    await expect(boundary.locator('article')).toHaveCount(2);
    await expect(boundary.locator('article').nth(0).locator('li')).toHaveCount(2);
    await expect(boundary.locator('article').nth(1).locator('li')).toHaveCount(2);
    await expect(boundary.getByRole('link', {
      name: 'Price your Simple cover',
      exact: true,
    })).toHaveAttribute('href', '#price-your-cover');
    await expect(page.getByRole('link', { name: 'Explore Custom design' })).toHaveAttribute(
      'href',
      '/custom-pergolas-auckland',
    );
    await expect(page.locator('#acrylic-enquiry-type')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Request a site measure' })).toBeAttached();

    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(0);

    const sectionLayout = await page.locator('main > section').evaluateAll((sections) => (
      sections.map((section) => {
        const box = section.getBoundingClientRect();
        return { top: box.top + window.scrollY, bottom: box.bottom + window.scrollY };
      })
    ));
    for (let index = 1; index < sectionLayout.length; index += 1) {
      expect(sectionLayout[index].top).toBeGreaterThanOrEqual(
        sectionLayout[index - 1].bottom - 2,
      );
    }

    await page.locator('main > section').first().getByRole('link', {
      name: 'Price your Simple cover',
      exact: true,
    }).click();
    const headerBox = await page.locator('header.site').boundingBox();
    const calculatorBox = await calculatorSection.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(calculatorBox).not.toBeNull();
    expect(calculatorBox!.y).toBeGreaterThanOrEqual(
      headerBox!.y + headerBox!.height + 8,
    );
  });
}

test('homepage context stays attributed in a compact strip after the calculator', async ({ page }) => {
  await preparePage(page);
  await page.goto(`${route}?project=cover&priorities=daylight%2Ceveryday-use`);

  const context = page.locator('[data-project-finder-journey-context]');
  await expect(context).toHaveAttribute('data-project-direction', 'cover');
  await expect(context).toHaveAttribute(
    'data-project-priorities',
    'daylight,everyday-use',
  );
  await expect(context.getByText(
    'A simple cover designed to preserve natural light and make the space work every day.',
  )).toBeVisible();
  await expect(page.getByRole('link', { name: 'Refine your brief' })).toHaveAttribute(
    'href',
    '/?project=cover&priorities=daylight%2Ceveryday-use',
  );
  expect(await page.locator('#price-your-cover').evaluate((calculator) => (
    calculator.previousElementSibling?.matches('main > section:first-child') ?? false
  ))).toBe(true);
  const levelComparison = page.locator('section[aria-labelledby="simple-level-comparison-title"]');
  expect(await levelComparison.evaluate((section) => (
    section.previousElementSibling?.id === 'price-your-cover'
  ))).toBe(true);
  expect(await context.evaluate((savedBrief) => (
    savedBrief.previousElementSibling?.getAttribute('aria-labelledby')
      === 'simple-level-comparison-title'
  ))).toBe(true);
  expect(await context.evaluate((savedBrief) => (
    savedBrief.getBoundingClientRect().height < 280
  ))).toBe(true);

  const formContext = page.locator('input[name="enquiryContext"]');
  await expect(formContext).toHaveValue(/"source_experience":"project-finder-home-v1"/);
  await expect(formContext).toHaveValue(/"project_direction":"cover"/);
  await expect(formContext).toHaveValue(
    /"project_priorities":\["daylight","everyday-use"\]/,
  );
  await expect(page.locator('input[name="page"]')).toHaveValue(route);
});

test('a priced result carries the exact configured cover into the review form and payload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await preparePage(page);
  let enquiryPayload: Record<string, unknown> | null = null;
  await page.route('**/api/enquiry', async (requestRoute) => {
    enquiryPayload = requestRoute.request().postDataJSON() as Record<string, unknown>;
    await requestRoute.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.goto(route);

  const reviewCta = page.getByRole('link', {
    name: 'Request a site measure',
  });
  await expect(reviewCta).toBeVisible();
  await reviewCta.click();

  await expect(page.locator('#estimate-form-title')).toBeFocused();
  expect(new URL(page.url()).hash).toBe('#initial-estimate');
  const summary = page.locator('[data-simple-cover-enquiry-summary="priced"]');
  await expect(summary).toContainText('Your estimate is ready for a site measure request.');
  await expect(summary).toContainText('From $24,250');
  await expect(summary).toContainText('6.0 m × 3.0 m');
  await expect(summary).toContainText('Ground level');
  await expect(summary).toContainText('Fascia');
  await expect(page.locator('#acrylic-enquiry-width')).toHaveCount(0);
  await expect(page.locator('#acrylic-enquiry-depth')).toHaveCount(0);

  await page.getByLabel('Name Required').fill('Test Customer');
  await page.getByLabel('Phone Required').fill('021 234 5678');
  await page.getByLabel('Email Required').fill('test@example.com');
  await page.getByRole('button', { name: 'Request a site measure' }).click();
  await expect.poll(() => enquiryPayload).not.toBeNull();

  expect(enquiryPayload).toMatchObject({
    calculationRef,
    simpleCoverStatus: 'priced',
    dimensions: {
      widthM: null,
      depthM: null,
      heightM: null,
    },
  });
  expect(page.url()).not.toContain(calculationRef);
  expect(page.url()).not.toMatch(/[?&](?:width|projection|price)=/);
});

test('form-start analytics is consented, closed and emitted once on real form use', async ({ page }) => {
  await preparePage(page, { analytics: true });
  await page.goto(route);
  await page.getByRole('link', {
    name: 'Request a site measure',
  }).click();

  const readFormEvents = () => page.evaluate(() => (
    ((window as typeof window & { dataLayer?: Array<unknown> }).dataLayer ?? [])
      .filter((entry): entry is Record<string, unknown> => (
        Boolean(entry)
        && !Array.isArray(entry)
        && typeof entry === 'object'
        && (entry as Record<string, unknown>).event === 'simple_calculator_form_start'
      ))
  ));

  expect(await readFormEvents()).toHaveLength(0);
  await page.locator('#acrylic-enquiry-suburb').focus();
  await expect.poll(async () => (await readFormEvents()).length).toBe(1);
  await page.locator('#acrylic-enquiry-name').fill('Analytics Test');
  const events = await readFormEvents();
  expect(events).toHaveLength(1);
  expect(events[0]).toEqual({
    event: 'simple_calculator_form_start',
    placement: 'embedded',
    result_status: 'priced',
    source_path: route,
    viewport_category: 'desktop',
    calculation_attached: true,
  });
  expect(JSON.stringify(events[0])).not.toMatch(
    /24_?250|6000|3000|playwright-opaque|Analytics Test/i,
  );
});

test('Custom and unavailable results keep useful same-page continuations', async ({ page }) => {
  await preparePage(page);
  await page.goto(route);
  await setRange(page, 'Projection from the house', 6_000);
  await setRange(page, 'Width along the house', 10_000);

  await expect(page.locator('[data-result-state="custom"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore Custom design' })).toHaveCount(2);
  await page.getByRole('link', {
    name: 'Ask Sanctuary to review these selections',
  }).click();
  expect(new URL(page.url()).hash).toBe('#initial-estimate');
  await expect(page.locator('[data-simple-cover-enquiry-summary="custom"]')).toContainText(
    'This footprint needs a Custom review.',
  );
  await expect(page.getByRole('button', {
    name: 'Send for Sanctuary review',
    exact: true,
  })).toBeVisible();

  const unavailablePage = await page.context().newPage();
  await preparePage(unavailablePage, { priceStatus: 'unavailable' });
  await unavailablePage.goto(route);
  await expect(unavailablePage.locator('[data-result-state="unavailable"]')).toBeVisible();
  await unavailablePage.getByRole('link', {
    name: 'Send these selections for review',
  }).click();
  await expect(
    unavailablePage.locator('[data-simple-cover-enquiry-summary="unavailable"]'),
  ).toContainText('Your selections are ready for review.');
  await expect(unavailablePage.getByRole('button', {
    name: 'Send for Sanctuary review',
    exact: true,
  })).toBeVisible();
  await unavailablePage.close();
});

test('a valid standalone handoff hydrates the calculator and form without URL data', async ({ page }) => {
  await preparePage(page);
  await page.addInitScript(({ storageKey, storedCalculationRef }) => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      schemaVersion: 'simple-cover-handoff.v1',
      status: 'priced',
      input: {
        widthMm: 7_200,
        projectionMm: 3_400,
        level: 'elevated',
        connection: 'soffit',
      },
      calculationRef: storedCalculationRef,
      displayedPriceIncGst: 31_500,
      configurationVersion: 23,
    }));
  }, {
    storageKey: 'sanctuary.simple-cover-handoff.v1',
    storedCalculationRef: calculationRef,
  });
  await page.goto(`${route}#initial-estimate`);

  await expect(page.getByRole('textbox', {
    name: 'Width along the house in metres',
  })).toHaveValue('7.2');
  const summary = page.locator('[data-simple-cover-enquiry-summary="priced"]');
  await expect(summary).toContainText('7.2 m × 3.4 m');
  await expect(summary).toContainText('Elevated / first floor');
  await expect(summary).toContainText('Soffit brackets');
  const finalUrl = new URL(page.url());
  expect(finalUrl.pathname).toBe(route);
  expect(finalUrl.hash).toBe('#initial-estimate');
  expect(finalUrl.search).toBe('');
});

test('the page remains useful without JavaScript', async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(route);

  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Cover the space without losing light.',
  })).toBeVisible();
  await expect(page.getByRole('heading', {
    name: 'Set the footprint. See the installed estimate.',
  })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Simple form. Sanctuary finish.' })).toBeVisible();
  await expect(page.locator('[data-simple-price-integration="fit-section"]')).toHaveCount(0);
  const form = page.locator('form[action="/api/enquiry/fallback"]');
  await expect(form).toBeVisible();
  await expect(form.locator('input[name="page"]')).toHaveValue(route);
  await expect(page.getByText('File upload needs JavaScript.')).toBeVisible();
  await context.close();
});

test('the noindex conversion page stays out of the sitemap', async ({ page }) => {
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).not.toContainText('/simple-pergolas-auckland');
  await expect(page.locator('body')).toContainText('/acrylic-roof-pergolas-auckland');
});
