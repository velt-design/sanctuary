import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { buildEnquiryHref } from '../apps/marketing/lib/enquiryContext';

const evidenceDirectory = path.join(process.cwd(), 'artifacts', 'mobile-ux-phase-3-pr-6');
const capture = process.env.MARKETING_FOUNDATION_CAPTURE?.trim();
const interactionEvidenceDirectory = path.join(process.cwd(), 'artifacts', 'mobile-ux-phase-3-pr-7');
const interactionCapture = process.env.MARKETING_FOUNDATION_INTERACTIONS_CAPTURE?.trim();

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'compact desktop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'large mobile', width: 430, height: 932 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact mobile', width: 360, height: 800 },
];

const directConsumers = [
  { name: 'homepage', route: '/' },
  { name: 'foundation catalogue', route: '/__foundation/marketing' },
  { name: 'acrylic landing page', route: '/acrylic-roof-pergolas-auckland' },
  { name: 'acrylic copy variant', route: '/acrylic-roof-pergolas-auckland-v2' },
  { name: 'service landing page', route: '/pergolas-auckland' },
  { name: 'SEO landing template', route: '/custom-pergolas-auckland' },
  { name: 'guide hub', route: '/pergola-guides' },
  { name: 'privacy page', route: '/privacy' },
  { name: 'product hub', route: '/products' },
  { name: 'product detail', route: '/products/pergolas/gable' },
] as const;

async function getVisibleFoundation(page: Page) {
  const foundation = page.locator('main[data-marketing-foundation-page]:visible');
  await expect(foundation).toHaveCount(1);
  return foundation;
}

test('direct Foundation consumers remain stable in isolated mobile and desktop contexts', async ({ browser }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
  ] as const) {
    for (const consumer of directConsumers) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.localStorage.setItem('sp_consent_v1', JSON.stringify({
          analytics: false,
          marketing: false,
          updatedAt: new Date().toISOString(),
          version: 1,
        }));
      });

      const response = await page.goto(consumer.route);
      expect(response?.ok(), `${consumer.name} should resolve at ${viewport.width}px`).toBe(true);
      const main = page.locator('main[data-marketing-foundation-page]:visible');
      await expect(main, `${consumer.name} should expose one visible Foundation consumer`).toHaveCount(1);
      await expect(main.locator('h1'), `${consumer.name} should preserve one page heading`).toHaveCount(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        `${consumer.name} should not overflow at ${viewport.width}px`,
      ).toBe(true);

      await context.close();
    }
  }
});

for (const viewport of viewports) {
  test(`standalone foundation is complete and fluid at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/__foundation/marketing');
    const foundation = await getVisibleFoundation(page);

    await expect(foundation.getByRole('heading', { level: 1, name: 'Architectural Editorial UI Foundation' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('header.site')).toBeHidden();
    await expect(foundation.getByText('Transparent / over hero')).toBeVisible();
    await expect(foundation.getByRole('heading', { name: 'Architectural pergolas tailored to Kiwi homes.' })).toBeVisible();
    await expect(foundation.getByRole('link', { name: 'Start your project' }).first()).toHaveCSS('background-color', 'rgb(79, 87, 72)');
    await expect(foundation.getByRole('heading', { name: 'Warkworth Outdoor Room' }).first()).toBeVisible();
    await expect(foundation.getByText('Responsive composition')).toBeVisible();
    await expect(foundation.locator('[data-foundation-primitives]')).toBeVisible();
    await expect(foundation.locator('[data-foundation-primitives] [data-editorial-card]')).toHaveCount(3);
    await expect(foundation.getByRole('progressbar', { name: 'Enquiry progress' })).toBeVisible();
    await expect(foundation.getByLabel('Name')).toBeVisible();
    await expect(foundation.getByText('Thank you. We’ll be in touch shortly.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test(`public homepage retains its approved implementation at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    const main = page.locator('main[data-homepage-variant="v2"]');
    await expect(main.getByRole('heading', { level: 1, name: 'Bespoke pergolas, built around the architecture.' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Get an initial project estimate' })).toHaveAttribute('href', buildEnquiryHref({
      enquiryType: 'residential',
      sourcePath: '/',
      sourceComponent: 'hero',
    }));
    await expect(main.getByRole('heading', { name: 'Three stages, with expectations confirmed in writing.' })).toBeAttached();
    await expect(main.locator('[data-home-section]')).toHaveCount(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

for (const viewport of [
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const) {
  test(`shared foundation primitives keep their mobile contracts at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/__foundation/marketing');

    const foundation = await getVisibleFoundation(page);
    const specimen = foundation.locator('[data-foundation-primitives]');
    const sectionHeader = specimen.locator('[data-section-header]');
    const actions = specimen.locator('[data-action-group]');
    const cards = specimen.locator('[data-editorial-card]');
    const facts = specimen.locator('[data-fact-list]');
    const responsiveMedia = specimen.locator('figure[data-mobile-ratio="standard"]').last();

    await expect(sectionHeader.getByRole('heading', {
      level: 2,
      name: 'One responsive contract, three deliberate card densities.',
    })).toBeVisible();
    await expect(actions.locator('[data-action-variant="primary"]')).toHaveCount(1);
    await expect(actions.locator('[data-action-variant="secondary"]')).toHaveCount(1);
    await expect(actions.locator('[data-action-variant="text"]')).toHaveCount(1);
    await expect(actions.locator('[data-action-variant="primary"]')).toHaveCSS('background-color', 'rgb(79, 87, 72)');
    await expect(actions.locator('[data-action-variant="secondary"]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(actions.locator('[data-action-variant="secondary"]')).toHaveCSS('border-top-style', 'solid');
    await expect(actions.locator('[data-action-variant="text"]')).toHaveCSS('border-bottom-style', 'solid');
    await expect(cards).toHaveCount(3);
    await expect(facts.locator('dt')).toHaveCount(3);
    await expect(facts.locator('dd')).toHaveCount(3);

    const headerGeometry = await sectionHeader.evaluate((element) => {
      const lead = element.children[0].getBoundingClientRect();
      const support = element.children[1].getBoundingClientRect();
      return { leadBottom: lead.bottom, supportTop: support.top };
    });
    expect(headerGeometry.supportTop).toBeGreaterThanOrEqual(headerGeometry.leadBottom);

    const actionTargets = actions.locator('a');
    for (let index = 0; index < await actionTargets.count(); index += 1) {
      const bounds = await actionTargets.nth(index).boundingBox();
      expect(bounds, `action ${index + 1} should be rendered`).not.toBeNull();
      expect(bounds!.width, `action ${index + 1} should be at least 44px wide`).toBeGreaterThanOrEqual(44);
      expect(bounds!.height, `action ${index + 1} should be at least 44px high`).toBeGreaterThanOrEqual(44);
    }
    const primaryBounds = await actions.locator('[data-action-variant="primary"]').boundingBox();
    expect(primaryBounds!.height).toBeGreaterThanOrEqual(48);

    const cardGeometry = await cards.evaluateAll((elements) => elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom, width: bounds.width };
    }));
    expect(cardGeometry.map((card) => card.width)).toEqual(
      cardGeometry.map(() => cardGeometry[0].width),
    );
    expect(cardGeometry[1].top).toBeGreaterThanOrEqual(cardGeometry[0].bottom - 1);
    expect(cardGeometry[2].top).toBeGreaterThanOrEqual(cardGeometry[1].bottom - 1);

    const factGeometry = await facts.locator(':scope > div').evaluateAll((elements) => (
      elements.map((element) => element.getBoundingClientRect().toJSON())
    ));
    expect(factGeometry[1].top).toBeGreaterThanOrEqual(factGeometry[0].bottom - 1);
    expect(factGeometry[2].top).toBeGreaterThanOrEqual(factGeometry[1].bottom - 1);

    const mediaState = await responsiveMedia.locator(':scope > div').evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const image = element.querySelector('img');
      return {
        ratio: bounds.width / bounds.height,
        objectPosition: image ? getComputedStyle(image).objectPosition : null,
      };
    });
    expect(mediaState.ratio).toBeCloseTo(4 / 3, 1);
    expect(mediaState.objectPosition).toBe('42% 50%');

    for (const focusTarget of [
      actions.locator('[data-action-variant="primary"]'),
      actions.locator('[data-action-variant="secondary"]'),
      actions.locator('[data-action-variant="text"]'),
      cards.first(),
    ]) {
      await focusTarget.focus();
      const focusState = await focusTarget.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          focusVisible: element.matches(':focus-visible'),
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth),
        };
      });
      expect(focusState.focusVisible).toBe(true);
      expect(focusState.outlineStyle).not.toBe('none');
      expect(focusState.outlineWidth).toBeGreaterThanOrEqual(2);
    }

    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true);
  });
}

test('shared foundation primitives retain stable desktop composition', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/__foundation/marketing');

  const foundation = await getVisibleFoundation(page);
  const specimen = foundation.locator('[data-foundation-primitives]');
  await expect(specimen).toBeVisible();
  await specimen.scrollIntoViewIfNeeded();
  const cards = specimen.locator('[data-editorial-card]');
  const cardGeometry = await cards.evaluateAll((elements) => elements.map((element) => (
    element.getBoundingClientRect().toJSON()
  )));
  expect(new Set(cardGeometry.map((card) => Math.round(card.top))).size).toBe(1);
  expect(Math.max(...cardGeometry.map((card) => card.width)) - Math.min(...cardGeometry.map((card) => card.width)))
    .toBeLessThanOrEqual(1);

  const responsiveMedia = specimen.locator('figure[data-mobile-ratio="standard"]').last();
  const mediaState = await responsiveMedia.locator(':scope > div').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const image = element.querySelector('img');
    return {
      ratio: bounds.width / bounds.height,
      objectPosition: image ? getComputedStyle(image).objectPosition : null,
    };
  });
  expect(mediaState.ratio).toBeCloseTo(16 / 10, 1);
  expect(mediaState.objectPosition).toBe('50% 50%');
});

test('shared action and card motion is removed when reduced motion is requested', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/__foundation/marketing');

  const foundation = await getVisibleFoundation(page);
  const specimen = foundation.locator('[data-foundation-primitives]');
  const motionState = await specimen.evaluate((element) => {
    const primary = element.querySelector<HTMLElement>('[data-action-variant="primary"]');
    const textLink = element.querySelector<HTMLElement>('[data-action-variant="text"]');
    const card = element.querySelector<HTMLElement>('[data-editorial-card]');
    return {
      primary: primary ? getComputedStyle(primary).transitionDuration : null,
      textLinkArrow: textLink ? getComputedStyle(textLink, '::after').transitionDuration : null,
      card: card ? getComputedStyle(card).transitionDuration : null,
    };
  });

  for (const duration of Object.values(motionState)) {
    expect(duration?.split(', ').every((value) => value === '0s')).toBe(true);
  }
});

test('foundation mobile navigation and FAQ preserve keyboard behavior and focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/__foundation/marketing');
  const foundation = await getVisibleFoundation(page);

  const menuButton = foundation.getByRole('button', { name: /Menu/ });
  await menuButton.click();
  await expect(page.locator('body')).toHaveClass(/foundation-menu-open/);
  await expect(foundation.getByRole('navigation', { name: 'Foundation mobile sections' })).toBeVisible();
  await expect(foundation.getByRole('link', { name: 'Foundation' }).last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menuButton).toBeFocused();
  await expect(page.locator('body')).not.toHaveClass(/foundation-menu-open/);
  expect(await menuButton.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');

  const faq = foundation.getByText('How early can I get an estimate?');
  await faq.click();
  await expect(foundation.getByText('Share photos and rough dimensions with the team')).toBeVisible();
});

test('foundation route is excluded from the public sitemap', async ({ page }) => {
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).not.toContainText('__foundation');
});

test('capture shared mobile primitive evidence', async ({ page }) => {
  test.skip(!capture, 'Set MARKETING_FOUNDATION_CAPTURE=1 to capture PR 6 evidence.');
  await mkdir(evidenceDirectory, { recursive: true });

  for (const viewport of [
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto('/__foundation/marketing');
    await page.addStyleTag({
      content: '[data-foundation-navigation] { position: static !important; }',
    });
    const foundation = await getVisibleFoundation(page);
    const specimen = foundation.locator('[data-foundation-primitives]');
    await expect(specimen).toBeVisible();
    await specimen.scrollIntoViewIfNeeded();
    await expect.poll(() => specimen.locator('img').evaluateAll((images) => (
      images.every((image) => image.complete && image.naturalWidth > 0)
    ))).toBe(true);
    await specimen.screenshot({
      path: path.join(evidenceDirectory, `foundation-primitives-${viewport.width}x${viewport.height}.png`),
    });
  }
});

for (const viewport of [
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const) {
  test(`shared disclosure and gallery contracts remain accessible at ${viewport.width}px`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto('/__foundation/marketing');

    const foundation = await getVisibleFoundation(page);
    const specimen = foundation.locator('[data-foundation-interactions]');
    const disclosures = specimen.locator('details[data-disclosure="manual"]');
    const firstDisclosure = disclosures.first();
    const firstSummary = firstDisclosure.locator(':scope > summary');
    const gallery = specimen.getByRole('region', { name: 'Completed pergola examples' });
    const previous = gallery.getByRole('button', { name: 'Previous image in Completed pergola examples' });
    const next = gallery.getByRole('button', { name: 'Next image in Completed pergola examples' });
    const status = gallery.getByRole('status');

    await expect(specimen.getByRole('heading', {
      name: 'One content tree, with controls that work without a gesture.',
    })).toBeVisible();
    await expect(disclosures).toHaveCount(2);
    await expect(firstDisclosure).not.toHaveAttribute('open', '');
    await firstSummary.focus();
    await page.keyboard.press('Enter');
    await expect(firstDisclosure).toHaveAttribute('open', '');
    await expect(firstDisclosure.getByText('Share the site location')).toBeVisible();
    await expect(firstSummary).toBeFocused();
    await page.keyboard.press('Space');
    await expect(firstDisclosure).not.toHaveAttribute('open', '');
    await expect(firstSummary).toBeFocused();

    await expect(gallery).toHaveAttribute('aria-roledescription', 'carousel');
    await expect(gallery.locator('img')).toHaveCount(1);
    await expect(gallery.locator('img')).toHaveAttribute(
      'alt',
      'Warkworth outdoor room integrated with a weatherboard home',
    );
    await expect(status).toHaveText('Image 1 of 3');

    for (const control of [previous, next]) {
      const bounds = await control.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }

    await next.tap();
    await expect(status).toHaveText('Image 2 of 3');
    await expect(gallery.locator('img')).toHaveCount(1);
    await expect(gallery.locator('img')).toHaveAttribute('alt', 'Dairy Flat gable pergola beside a rural home');

    await next.focus();
    await page.keyboard.press('End');
    await expect(status).toHaveText('Image 3 of 3');
    await expect(next).toBeFocused();
    await page.keyboard.press('Home');
    await expect(status).toHaveText('Image 1 of 3');
    await expect(next).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(status).toHaveText('Image 3 of 3');
    await expect(next).toBeFocused();

    const summaryBounds = await firstSummary.boundingBox();
    expect(summaryBounds).not.toBeNull();
    expect(summaryBounds!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true);

    await context.close();
  });
}

test('shared interactions retain stable desktop defaults and homepage compatibility', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/__foundation/marketing');

  const foundation = await getVisibleFoundation(page);
  const specimen = foundation.locator('[data-foundation-interactions]');
  await specimen.scrollIntoViewIfNeeded();
  const gridChildren = specimen.locator('[class*="interactionGrid"] > *');
  const geometry = await gridChildren.evaluateAll((elements) => elements.map((element) => (
    element.getBoundingClientRect().toJSON()
  )));
  expect(geometry).toHaveLength(2);
  expect(Math.abs(geometry[0].top - geometry[1].top)).toBeLessThanOrEqual(1);
  await expect(specimen.locator('[data-responsive-gallery] img')).toHaveCount(1);

  await page.goto('/');
  const disclosures = page.locator('main[data-homepage-variant="v2"] [data-mobile-disclosure]');
  await expect(disclosures.first()).toHaveAttribute('data-disclosure', 'desktop-expanded');
  await expect(disclosures.first()).toHaveAttribute('open', '');
  await expect(disclosures.first().locator(':scope > summary')).toBeHidden();
  await expect(disclosures.first().locator(':scope > div')).toBeVisible();
  await expect(disclosures.first()).toHaveAttribute('data-homepage-toggle-event');
});

test('homepage disclosure adapter preserves mobile native state, focus and analytics attributes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const disclosure = page.locator('main[data-homepage-variant="v2"] [data-mobile-disclosure]').first();
  const summary = disclosure.locator(':scope > summary');
  await expect(disclosure).toHaveAttribute('data-disclosure', 'desktop-expanded');
  await expect(disclosure).toHaveAttribute('data-homepage-toggle-event');
  await expect(disclosure).not.toHaveAttribute('open', '');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  await expect(disclosure.locator(':scope > div')).toBeVisible();
});

test('shared disclosure and gallery motion is removed when reduced motion is requested', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/__foundation/marketing');

  const specimen = (await getVisibleFoundation(page)).locator('[data-foundation-interactions]');
  const motionState = await specimen.evaluate((element) => {
    const disclosureIcon = element.querySelector<HTMLElement>('[data-disclosure] summary > span:last-child');
    const galleryButton = element.querySelector<HTMLElement>('[data-responsive-gallery] button');
    return {
      disclosureIconBefore: disclosureIcon
        ? getComputedStyle(disclosureIcon, '::before').transitionDuration
        : null,
      disclosureIconAfter: disclosureIcon
        ? getComputedStyle(disclosureIcon, '::after').transitionDuration
        : null,
      galleryButton: galleryButton ? getComputedStyle(galleryButton).transitionDuration : null,
    };
  });

  for (const duration of Object.values(motionState)) {
    expect(duration?.split(', ').every((value) => value === '0s')).toBe(true);
  }
});

test('capture shared interaction evidence', async ({ page }) => {
  test.skip(!interactionCapture, 'Set MARKETING_FOUNDATION_INTERACTIONS_CAPTURE=1 to capture PR 7 evidence.');
  await mkdir(interactionEvidenceDirectory, { recursive: true });

  for (const viewport of [
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto('/__foundation/marketing');
    await page.addStyleTag({
      content: '[data-foundation-navigation] { position: static !important; }',
    });
    const specimen = (await getVisibleFoundation(page)).locator('[data-foundation-interactions]');
    await specimen.scrollIntoViewIfNeeded();
    await expect.poll(() => specimen.locator('img').evaluateAll((images) => (
      images.every((image) => image.complete && image.naturalWidth > 0)
    ))).toBe(true);
    await page.evaluate(() => {
      document.querySelectorAll('nextjs-portal').forEach((portal) => portal.remove());
    });
    await specimen.screenshot({
      path: path.join(
        interactionEvidenceDirectory,
        `foundation-interactions-${viewport.width}x${viewport.height}.png`,
      ),
    });
  }
});
