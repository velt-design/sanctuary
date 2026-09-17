import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  buildEnquiryHref,
  getEnquiryRouteContext,
} from '../apps/marketing/lib/enquiryContext';

const establishedHeaderRoutes = [
  '/',
  '/projects',
  '/projects/warkworth-outdoor-room',
  '/projects/goodhome-commercial-terrace',
  '/products',
  '/products/pergolas/pitched',
  '/gallery',
  '/contact',
  '/privacy',
  '/commercial-pergolas-auckland',
] as const;

const evidenceDirectory = path.join(process.cwd(), 'artifacts', 'marketing-foundation-evolution', 'header-captures');
const capture = process.env.MARKETING_SHARED_HEADER_CAPTURE?.trim();

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sp_consent_v1', JSON.stringify({
      analytics: false,
      marketing: false,
      updatedAt: new Date().toISOString(),
      version: 1,
    }));
  });
}

test('header and menu surfaces remain painted over product content', async ({ page }) => {
  await preparePage(page);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/products/pergolas/gable');
    const header = page.locator('header.site');
    await expect(header).toBeVisible();
    // A BOM before :root survived production CSS bundling as a non-matching
    // selector, leaving all shared surface tokens undefined.
    await expect.poll(() => header.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--headerSurface').trim(),
    )).toBe('#f8f8f5');
    await page.evaluate(() => window.scrollTo(0, window.innerHeight + 200));
    await expect(header).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    if (width < 901) {
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      await expect(page.locator('#mobile-menu')).toHaveCSS('background-color', 'rgb(238, 238, 233)');
      await expect(page.locator('#mobile-menu')).toHaveCSS('color', 'rgb(17, 18, 16)');
      await page.keyboard.press('Escape');
      await expect(page.locator('#mobile-menu')).toHaveAttribute('aria-hidden', 'true');
    }
  }
});

test('public header action arrows are decorative SVGs rather than emoji glyphs', async ({ page }) => {
  await preparePage(page);
  await page.goto('/projects');
  const desktopAction = page.locator('header.site .nav-cta');
  await expect(desktopAction.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  await expect(desktopAction).toHaveAccessibleName('Start your project');
  expect(await desktopAction.evaluate(element => getComputedStyle(element, '::after').content)).not.toContain('↗');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const mobileAction = page.locator('.mobile-menu__design');
  await expect(mobileAction.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  await expect(mobileAction).toHaveAccessibleName('Design your pergola');
  expect(await page.locator('#mobile-menu').textContent()).not.toContain('↗');
  await expect(mobileAction.locator('svg')).toHaveAttribute('stroke', 'currentColor');
});

test('component-owned menu styling wins over late legacy global rules', async ({ page }) => {
  await preparePage(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('[data-homepage-welcome]')).toHaveCount(0);
  // Reintroduce the old global declarations seen in the owner's phone photos,
  // after all current styles. Component-scoped CSS must still own new markup.
  await page.addStyleTag({content: `
    body:has([data-editorial-website]):not(:has([data-project-preview])) header.site {background:#eeeee9!important;}
    .mobile-menu {inset:64px 0 auto;height:auto;max-height:calc(100dvh - 64px);padding:1rem 20px 2rem;}
    .mobile-menu__link {font-size:.72rem;text-transform:uppercase;border-bottom:1px solid #c7cac3;}
    .mobile-menu__link--estimate {background:#4f5748;color:white;}
  `});
  await expect(page.locator('header.site')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await expect(page.locator('#mobile-menu')).toHaveCSS('height','844px');
  await expect(page.locator('.mobile-menu__masthead')).toHaveCSS('display','flex');
  await expect(page.locator('#mobile-menu .mobile-menu__link').first()).toHaveCSS('text-transform','none');
  await expect(page.locator('.mobile-menu__design')).toHaveCSS('display','flex');
  await expect(page.locator('.mobile-menu__link--estimate')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
});

test('the architectural editorial header is shared by established public routes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);

  for (const route of establishedHeaderRoutes) {
    await page.goto(route);
    const resolvedPath = new URL(page.url()).pathname;
    const header = page.locator('header.site');
    const cta = header.getByRole('link', { name: 'Start your project' });
    await expect(header).toBeVisible();
    await expect(header).toHaveAttribute('data-header-ui', 'architectural-editorial');
    if (resolvedPath === '/') {
      await expect(cta).toBeVisible();
    } else {
      await expect(cta).toBeVisible();
      await expect(cta).toHaveCSS('border-radius', '0px');
      await expect(cta).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(cta).toHaveAttribute('href', buildEnquiryHref({
        ...getEnquiryRouteContext(resolvedPath),
        sourcePath: resolvedPath,
        sourceComponent: 'header',
      }));
    }
    await expect(header.getByRole('navigation', { name: 'Primary' }).getByRole('link'))
      .toHaveText([
        'Projects',
        'Pergolas',
        'Commercial',
        'Professionals',
      ]);
    await expect(header.getByRole('link', { name: 'Commercial' }))
      .toHaveAttribute('href', '/commercial-pergolas-auckland');
    await expect(header.getByRole('link', { name: 'Professionals' }))
      .toHaveAttribute('href', '/architects-designers-builders');
    await expect(page.locator('#mobile-menu')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#mobile-menu')).toHaveAttribute('inert', '');
    await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toHaveCount(0);

    const geometry = await header.evaluate((element) => {
      const brand = element.querySelector<HTMLElement>('.site-brand');
      const products = element.querySelector<HTMLElement>('a[href="/products"]');
      const commercial = element.querySelector<HTMLElement>('a[href="/commercial-pergolas-auckland"]');
      if (!brand || !products || !commercial) return null;
      const productsRect = products.getBoundingClientRect();
      const commercialRect = commercial.getBoundingClientRect();
      return {
        headerHeight: element.getBoundingClientRect().height,
        headerBackground: getComputedStyle(element).backgroundColor,
        heroNavigation: element.dataset.heroNavigation ?? null,
        headerFont: getComputedStyle(element).fontFamily,
        brandFont: getComputedStyle(brand).fontFamily,
        navGapMidpoint: (productsRect.right + commercialRect.left) / 2,
        viewportCenter: window.innerWidth / 2,
      };
    });

    expect(geometry, `${route} should expose shared header geometry`).not.toBeNull();
    expect(geometry!.headerHeight).toBeCloseTo(83, 0);
    if (geometry!.heroNavigation === 'overlay') {
      expect(geometry!.headerBackground).toBe('rgba(0, 0, 0, 0)');
    } else {
      expect(geometry!.headerBackground).not.toBe('rgba(0, 0, 0, 0)');
    }
    expect(geometry!.headerFont).toContain('Inter Variable');
    expect(geometry!.brandFont).toContain('Instrument Sans Variable');
    expect(Math.abs(geometry!.navGapMidpoint - geometry!.viewportCenter)).toBeLessThanOrEqual(1);
  }
});

test('the editorial mobile menu traps and restores keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto('/contact');
  await expect(page.locator('[data-contact-page]:visible').last()).toBeVisible();
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 320));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(320);

  const header = page.locator('header.site');
  const menuButton = page.locator('button[aria-controls="mobile-menu"]');
  await expect(menuButton).toHaveAttribute('aria-label', 'Open menu');
  await expect(header).toHaveAttribute('data-header-ui', 'architectural-editorial');
  await expect(header).toHaveCSS('height', '65px');
  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveCSS('border-radius', '0px');
  await expect(menuButton).toHaveCSS('height', '44px');
  expect(await menuButton.evaluate((element) => getComputedStyle(element, '::before').content)).toBe('"Menu"');

  await menuButton.evaluate((element) => element.focus({ preventScroll: true }));
  await page.keyboard.press('Enter');
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile primary' });
  await expect(page.locator('body')).toHaveClass(/mobile-menu-open/);
  await expect(page.locator('body')).toHaveClass(/no-scroll/);
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  await expect(page.locator('body')).toHaveCSS('top', '-320px');
  await expect(mobileNavigation).toBeVisible();
  await expect(page.locator('header.site .desktop-nav')).toBeHidden();
  await expect(page.locator('#mobile-menu')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#mobile-menu')).not.toHaveAttribute('inert', '');
  await expect(mobileNavigation.getByRole('link').first()).toBeFocused();
  const focusedLinkStyle = await mobileNavigation.getByRole('link').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      focusVisible: element.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focusedLinkStyle.focusVisible).toBe(true);
  expect(focusedLinkStyle.outlineStyle).not.toBe('none');
  expect(focusedLinkStyle.outlineWidth).toBeGreaterThanOrEqual(2);
  await expect(mobileNavigation.getByRole('link')).toHaveText([
    'Projects',
    'Pergolas',
    'Commercial',
    'Professionals',
    'Design your pergola',
    'Discuss your project',
  ]);
  await expect(mobileNavigation.getByRole('link', { name: 'Professionals' }))
    .toHaveAttribute('href', '/architects-designers-builders');
  await expect(mobileNavigation.getByRole('link', { name: 'Discuss your project' }))
    .toHaveAttribute('href', buildEnquiryHref({
      sourcePath: '/contact',
      sourceComponent: 'header',
    }));

  for (const target of [menuButton, ...await mobileNavigation.getByRole('link').all()]) {
    const bounds = await target.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }

  await expect.poll(() => page.locator('#mobile-menu').evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(0, 0);

  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.mobile-menu__close')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(mobileNavigation.getByRole('link', { name: 'Discuss your project' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.mobile-menu__close')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(mobileNavigation.getByRole('link').first()).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);
  await expect(page.locator('body')).not.toHaveClass(/no-scroll/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(320);
  await expect(menuButton).toBeFocused();
  await expect(page.locator('#mobile-menu')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#mobile-menu')).toHaveAttribute('inert', '');
});

test('the full-screen close control restores the page without activating it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto('/contact');
  await expect(page.locator('[data-contact-page]:visible').last()).toBeVisible();
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 320));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(320);

  const originalUrl = page.url();
  const menuButton = page.locator('button[aria-controls="mobile-menu"]');
  const menu = page.locator('#mobile-menu');
  const backdrop = page.locator('[data-mobile-menu-backdrop]');

  await menuButton.click();
  await expect(menu).toHaveAttribute('role', 'dialog');
  await expect(menu).toHaveAttribute('aria-modal', 'true');
  await expect(backdrop).toHaveAttribute('data-mobile-menu-backdrop-state', 'open');

  const menuBounds = await menu.boundingBox();
  expect(menuBounds).not.toBeNull();
  expect(menuBounds!.height).toBe(844);
  await page.locator('.mobile-menu__close').click();
  await expect(menuButton).toBeFocused();

  await expect(menu).toHaveAttribute('data-mobile-menu-state', 'closed');
  await expect(backdrop).toHaveAttribute('data-mobile-menu-backdrop-state', 'closed');
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);
  await expect(page.locator('body')).not.toHaveClass(/no-scroll/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(320);
  expect(page.url()).toBe(originalUrl);
});

test('shared header destinations remain functional', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);
  await page.goto('/');
  await page.locator('header.site').getByRole('link', { name: 'Pergolas', exact: true }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.locator('main[data-products-index]')).toBeVisible();
});

test('compact desktop keeps audience routes visible without colliding with the project action', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await preparePage(page);
  await page.goto('/projects');

  const header = page.locator('header.site');
  const primary = header.getByRole('navigation', { name: 'Primary' });
  const commercial = primary.getByRole('link', { name: 'Commercial' });
  const professionals = primary.getByRole('link', { name: 'Professionals' });
  const projectAction = header.getByRole('link', { name: 'Start your project' });
  await expect(commercial).toBeVisible();
  await expect(professionals).toBeVisible();
  await expect(primary.getByRole('link', { name: 'Home' })).toBeHidden();
  await expect(primary.getByRole('link', { name: 'Contact' })).toBeHidden();

  const [professionalsBounds, actionBounds] = await Promise.all([
    professionals.boundingBox(),
    projectAction.boundingBox(),
  ]);
  expect(professionalsBounds).not.toBeNull();
  expect(actionBounds).not.toBeNull();
  expect(professionalsBounds!.x + professionalsBounds!.width)
    .toBeLessThanOrEqual(actionBounds!.x - 4);
});

test('the skip link moves keyboard focus to the public content boundary', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await preparePage(page);
  await page.goto('/contact');

  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  const initialBounds = await skipLink.boundingBox();
  expect(initialBounds).not.toBeNull();
  expect(initialBounds!.y + initialBounds!.height).toBeLessThanOrEqual(0);
  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('the skip link stays out of layout if the stylesheet is unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await preparePage(page);
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'stylesheet') {
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.goto('/');

  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  const bounds = await skipLink.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(0);
});

for (const viewport of [
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const) {
  test(`mobile destinations, focus and targets remain stable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await preparePage(page);
    await page.goto('/products/pergolas/pitched');

    const menuButton = page.locator('button[aria-controls="mobile-menu"]');
    await menuButton.click();
    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile primary' });
    await expect(mobileNavigation).toBeVisible();
    await expect(mobileNavigation.getByRole('link', { name: 'Pergolas', exact: true }))
      .toHaveAttribute('aria-current', 'page');
    await expect.poll(() => page.locator('#mobile-menu').evaluate(
      (element) => element.getBoundingClientRect().top,
    )).toBeCloseTo(0, 0);

    const menuGeometry = await page.locator('#mobile-menu').evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        viewportWidth: window.innerWidth,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(menuGeometry.left).toBeGreaterThanOrEqual(0);
    expect(menuGeometry.right).toBeLessThanOrEqual(menuGeometry.viewportWidth);
    expect(menuGeometry.top).toBeCloseTo(0, 0);
    expect(menuGeometry.documentOverflow).toBeLessThanOrEqual(0);

    for (const target of [menuButton, ...await mobileNavigation.getByRole('link').all()]) {
      const bounds = await target.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }

    await page.keyboard.press('Escape');
    await expect(menuButton).toBeFocused();
  });
}

test('the mobile menu remains operable at tablet width and short viewport heights', async ({ page }) => {
  await preparePage(page);

  await page.setViewportSize({ width: 768, height: 700 });
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 360, height: 480 });
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Open menu' }).click();
  const menu = page.locator('#mobile-menu');
  const mobileNavigation = page.getByRole('navigation', {
    name: 'Mobile primary',
  });
  await expect(
    mobileNavigation.getByRole('link', { name: 'Projects' }),
  ).toBeFocused();
  const estimate = mobileNavigation.getByRole('link', {
    name: 'Discuss your project',
  });
  const shortViewportState = await menu.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      bottom: bounds.bottom,
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });
  expect(shortViewportState.bottom).toBeLessThanOrEqual(shortViewportState.viewportHeight);
  expect(shortViewportState.clientHeight).toBeLessThanOrEqual(480);
  expect(shortViewportState.scrollHeight).toBeGreaterThanOrEqual(shortViewportState.clientHeight);
  expect(shortViewportState.overflowY).toBe('auto');
  await estimate.focus();
  await expect(estimate).toBeFocused();
  await expect(estimate).toBeInViewport();
  await page.keyboard.press('Escape');
});

test('the mobile menu removes directly relevant motion when reduced motion is requested', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preparePage(page);
  await page.goto('/projects');

  const menuButton = page.locator('button[aria-controls="mobile-menu"]');
  const menu = page.locator('#mobile-menu');
  const header = page.locator('header.site');
  const menuButtonBox = await menuButton.boundingBox();
  expect(menuButtonBox).not.toBeNull();
  await page.mouse.click(
    menuButtonBox!.x + menuButtonBox!.width / 2,
    menuButtonBox!.y + menuButtonBox!.height / 2,
  );

  await expect(menu).toHaveCSS('transition-duration', '0s');
  await expect(menuButton).toHaveCSS('transition-duration', '0s');
  await expect(header).toHaveCSS('transition-duration', '0s');
  await page.keyboard.press('Escape');
});

test('audience-aware destinations and browser Back keep route and scroll context', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);

  for (const route of [
    '/commercial-pergolas-auckland',
    '/projects/goodhome-commercial-terrace',
    '/products/pergolas/gable',
    '/contact',
  ] as const) {
    await page.goto(route);
    await page.getByRole('button', { name: 'Open menu' }).click();
    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile primary' });
    await expect(mobileNavigation.getByRole('link', { name: 'Professionals' }))
      .toHaveAttribute('href', '/architects-designers-builders');
    await expect(mobileNavigation.getByRole('link', { name: 'Discuss your project' }))
      .toHaveAttribute('href', buildEnquiryHref({
        ...getEnquiryRouteContext(route),
        sourcePath: route,
        sourceComponent: 'header',
      }));
    await page.keyboard.press('Escape');
  }

  await page.goto('/contact');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Mobile primary' })
    .getByRole('link', { name: 'Pergolas', exact: true })
    .click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);

  await page.goBack();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);
  await expect(page.locator('body')).not.toHaveClass(/no-scroll/);
});

test('capture representative shared-header states', async ({ page }) => {
  test.skip(!capture, 'Set MARKETING_SHARED_HEADER_CAPTURE=1 to refresh visual evidence.');
  await preparePage(page);
  await mkdir(evidenceDirectory, { recursive: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('header.site')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(evidenceDirectory, 'homepage-header-desktop-1440x1000.png') });

  for (const viewport of [
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 360, height: 480 },
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeVisible();
    await expect.poll(() => page.locator('#mobile-menu').evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(0, 0);
    await expect(page.locator('#mobile-menu')).toHaveCSS('opacity','1');
    await page.screenshot({
      path: path.join(
        evidenceDirectory,
        `projects-mobile-menu-${viewport.width}x${viewport.height}.png`,
      ),
    });
  }
});


test('public header aligns with content edges on normal and wide collections', async ({page}) => {
  await preparePage(page);
  for (const width of [390, 1024, 1440, 1920]) {
    await page.setViewportSize({width,height:1000});
    for (const [route, selector] of [['/projects','.projects-experience__layout'],['/products/pergolas/gable','[data-editorial-detail]']]) {
      await page.goto(route);
      const geometry = await page.evaluate((selector) => {
        const main = document.querySelector(selector);
        const header = document.querySelector('header .navbar');
        return {main:main?.getBoundingClientRect().toJSON(),header:header?.getBoundingClientRect().toJSON()};
      },selector);
      if (route === '/projects') {
        expect(geometry.main).toBeTruthy();
        expect(geometry.header.x).toBeCloseTo(geometry.main.x,0);
        expect(geometry.header.right).toBeCloseTo(geometry.main.right,0);
      } else {
        const gutter=Math.max(20,Math.min(width*.04,72));
        expect(geometry.header.width).toBeCloseTo(Math.min(1280,width-2*gutter),0);
      }
    }
  }
});

test('editorial menu design and discussion actions retain context with safe return', async ({page}) => {
  await preparePage(page);
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/enquiry',route=>route.abort());
  await page.goto('/projects/warkworth-outdoor-room');
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  const menu=page.locator('#mobile-menu');
  await expect(menu.getByRole('link',{name:'Discuss your project'})).toHaveAttribute('href',/source_project=warkworth-outdoor-room/);
  await menu.getByRole('link',{name:'Design your pergola'}).click();
  await expect(page.getByRole('dialog',{name:'Design your pergola',exact:true})).toBeVisible();
  await expect(menu).toHaveAttribute('data-mobile-menu-state','closed');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await expect(page.locator('button[aria-controls="mobile-menu"]')).toBeFocused();
  await expect(page).toHaveURL(/projects\/warkworth-outdoor-room$/);
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);
});


test('menu stays opaque until a delayed destination arrives, and same-page close restores scroll', async ({page}) => {
  await preparePage(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/products**',async route=>{await held;await route.continue();});
  await page.locator('#mobile-menu').getByRole('link',{name:'Pergolas',exact:true}).click();
  await expect(page.locator('#mobile-menu')).toHaveAttribute('data-mobile-menu-state','open');
  await expect(page.locator('#mobile-menu')).toHaveCSS('opacity','1');
  release();
  await expect(page).toHaveURL(/products$/);
  await expect(page.locator('#mobile-menu')).toHaveAttribute('data-mobile-menu-state','closed');
  await expect(page.locator('header.site')).toHaveCSS('background-color','rgb(238, 238, 233)');
  await page.evaluate(()=>window.scrollTo(0,250));
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await page.locator('#mobile-menu').getByRole('link',{name:'Pergolas',exact:true}).click();
  await expect(page.locator('#mobile-menu')).toHaveAttribute('data-mobile-menu-state','closed');
  await expect(page.locator('button[aria-controls="mobile-menu"]')).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(250);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);
});


test.describe('homepage mobile overlay return states', () => {
  test.use({ isMobile: true, hasTouch: true });
  for (const width of [360,390,430]) for (const reducedMotion of ['no-preference','reduce'] as const) {
    test('transparent over the initial image at '+width+'px with '+reducedMotion, async ({page,baseURL}) => {
      await preparePage(page);
      await page.setViewportSize({width,height:844});
      await page.emulateMedia({reducedMotion});
      const header=page.locator('header.site');
      const expectOverlay=async()=>{
        await expect(header).toHaveAttribute('data-hero-navigation','overlay');
        await expect(header).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
        await expect(header.locator('.site-brand')).toHaveCSS('color','rgb(255, 255, 255)');
        await expect(header.locator('.mobile-toggle')).toHaveCSS('color','rgb(255, 255, 255)');
      };
      for (const origin of [baseURL!,process.env.MARKETING_HEADER_SECONDARY_URL].filter((url): url is string => Boolean(url))) {
        await page.goto(origin+'/');
        await expect(page.locator('[data-homepage-welcome]')).toHaveCount(0);
        await expectOverlay();
        await page.evaluate(()=>window.scrollTo(0,200));
        await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(200);
        await expectOverlay();
        await page.getByRole('button',{name:'Open menu',exact:true}).click();
        await expect(page.locator('#mobile-menu')).toHaveCSS('opacity','1');
        await expect(page.locator('#mobile-menu')).toHaveCSS('background-color','rgb(238, 238, 233)');
        await page.locator('.mobile-menu__close').click();
        await expect(page.locator('#mobile-menu')).toHaveCSS('opacity','0');
        await expectOverlay();
        await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(200);
        await page.evaluate(()=>window.scrollTo(0,1000));
        await expect(header).toHaveAttribute('data-hero-navigation','solid');
        await expect(header).toHaveCSS('background-color','rgb(238, 238, 233)');
        await page.evaluate(()=>window.scrollTo(0,0));
        await expectOverlay();
        await page.getByRole('button',{name:'Open menu',exact:true}).click();
        await page.locator('#mobile-menu').getByRole('link',{name:'Projects',exact:true}).click();
        await expect(page).toHaveURL(/projects$/);
        await page.goBack();
        await expect(page).toHaveURL(origin+'/');
        await expect(page.locator('[data-homepage-welcome]')).toHaveCount(0);
        await expectOverlay();
        await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);
        await page.screenshot({path:path.join(evidenceDirectory,'homepage-return-'+new URL(origin).port+'-'+width+'-'+reducedMotion+'.png')});
      }
    });
  }
});
