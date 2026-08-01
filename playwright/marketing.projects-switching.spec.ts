import { expect, test, type Page } from '@playwright/test';
import { projects } from '../apps/marketing/data/projects';

const initialProject = projects.find(
  ({ slug }) => slug === 'goodhome-commercial-terrace',
)!;
const targetProject = projects.find(({ slug }) => slug === 'dairy-flat-estate')!;
const initialRoute = `/projects/${initialProject.slug}`;
const targetRoute = `/projects/${targetProject.slug}`;
const publicOrigin = 'https://www.sanctuarypergolas.co.nz';

async function dismissConsent(page: Page) {
  const essentialOnly = page.getByRole('button', { name: 'Essential only' });
  if (await essentialOnly.count() && await essentialOnly.isVisible()) {
    await essentialOnly.click();
  }
}

function projectsMain(page: Page) {
  return page.locator('main[data-projects-experience]:visible').last();
}

function projectLink(page: Page, slug: string) {
  return projectsMain(page).locator(
    `.project-navigator__list a[href="/projects/${slug}"]`,
  );
}

async function expectProjectReady(page: Page, slug: string) {
  const main = projectsMain(page);
  await expect(main).toHaveAttribute('data-project-switch-state', 'ready');
  await expect(main.locator('[data-project-case-study]')).toHaveAttribute(
    'data-project-case-study',
    slug,
  );
  await expect.poll(() => main.locator('.project-case-study__hero img').evaluate(
    (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
  )).toBe(true);
}

async function prepareStableRail(page: Page, focusedSlug: string) {
  const main = projectsMain(page);
  const link = projectLink(page, focusedSlug);
  await link.focus();
  await main.locator('.project-navigator__list-wrap').evaluate((element) => {
    const rail = element as HTMLElement;
    rail.scrollTop = Math.min(240, rail.scrollHeight - rail.clientHeight);
  });
  await main.locator('.project-navigator__panel').evaluate((element) => {
    (element as HTMLElement).dataset.projectPersistenceProbe = 'preserved';
  });
}

async function readDesktopState(page: Page) {
  return projectsMain(page).evaluate((main) => {
    const required = (selector: string) => {
      const element = main.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return element;
    };
    const top = (selector: string) => required(selector).getBoundingClientRect().top;
    const heroBounds = required('.project-case-study__hero').getBoundingClientRect();
    const header = document.querySelector<HTMLElement>('header.site');
    const rail = required('.project-navigator__list-wrap');
    const focused = document.activeElement instanceof HTMLAnchorElement
      ? document.activeElement.getAttribute('href')
      : null;

    return {
      filtersTop: top('.project-navigator__filters'),
      headerBottom: header?.getBoundingClientRect().bottom ?? 0,
      heroBottom: heroBounds.bottom,
      heroTop: heroBounds.top,
      panelProbe: required('.project-navigator__panel')
        .dataset.projectPersistenceProbe ?? null,
      panelTop: top('.project-navigator__panel'),
      railScrollTop: rail.scrollTop,
      railTop: rail.getBoundingClientRect().top,
      scrollY: window.scrollY,
      focused,
    };
  });
}

function expectNear(actual: number, expected: number, tolerance = 1.25) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

for (const viewport of [
  { width: 1_920, height: 1_080 },
  { width: 1_200, height: 900 },
]) {
  test(`desktop switching is position-stable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(initialRoute);
    await dismissConsent(page);
    await expectProjectReady(page, initialProject.slug);
    await prepareStableRail(page, targetProject.slug);

    const before = await readDesktopState(page);
    const target = projectLink(page, targetProject.slug);
    await target.click();
    await expect(page).toHaveURL(new RegExp(`${targetRoute}$`));
    await expectProjectReady(page, targetProject.slug);
    const after = await readDesktopState(page);

    expectNear(after.heroTop, before.heroTop);
    expectNear(after.panelTop, before.panelTop);
    expectNear(after.filtersTop, before.filtersTop);
    expectNear(after.railTop, before.railTop);
    expectNear(after.railScrollTop, before.railScrollTop, 0.5);
    expectNear(after.scrollY, before.scrollY, 0.5);
    expect(after.panelProbe).toBe('preserved');
    expect(after.focused).toBe(targetRoute);

    const main = projectsMain(page);
    const hero = main.locator('.project-case-study__hero img');
    const heroFile = (targetProject.caseStudyHeroImage ?? targetProject.heroImage)
      .src.split('/').at(-1)!;
    await expect(hero).toHaveAttribute('src', new RegExp(heroFile.replace('.', '\\.')));
    expect(await hero.evaluate(
      (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
    )).toBe(true);
    await expect(target).toHaveAttribute('aria-current', 'page');
    await expect(target).toBeFocused();
    await expect(main.locator('[aria-live="polite"]').first())
      .toContainText(`${targetProject.title} project loaded.`);
    await expect(page.locator('.route-progress')).toHaveClass(/route-progress--idle/);
    await expect(page).toHaveTitle(
      `${targetProject.title} Pergola Project | Sanctuary Pergolas`,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${publicOrigin}${targetRoute}`,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      targetProject.blurb,
    );
    await expect(page.getByRole('banner').getByRole('link', {
      name: 'Start your project',
    })).toHaveAttribute('href', new RegExp(`source_project=${targetProject.slug}`));
    expect((await page.locator('script[type="application/ld+json"]').allTextContents())
      .join('\n')).toContain(`${publicOrigin}${targetRoute}`);

    if (viewport.width === 1_920) {
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`${initialRoute}$`));
      await expectProjectReady(page, initialProject.slug);
      const afterBack = await readDesktopState(page);
      expectNear(afterBack.heroTop, before.heroTop);
      expectNear(afterBack.railScrollTop, before.railScrollTop, 0.5);
      expect(afterBack.panelProbe).toBe('preserved');
      expect(afterBack.focused).toBe(targetRoute);
      await expect(page).toHaveTitle(
        `${initialProject.title} Pergola Project | Sanctuary Pergolas`,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${publicOrigin}${initialRoute}`,
      );

      await page.goForward();
      await expect(page).toHaveURL(new RegExp(`${targetRoute}$`));
      await expectProjectReady(page, targetProject.slug);
      const afterForward = await readDesktopState(page);
      expectNear(afterForward.heroTop, before.heroTop);
      expectNear(afterForward.railScrollTop, before.railScrollTop, 0.5);
      await expect(page).toHaveTitle(
        `${targetProject.title} Pergola Project | Sanctuary Pergolas`,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${publicOrigin}${targetRoute}`,
      );
      await expect(page.locator('.route-progress')).toHaveClass(/route-progress--idle/);
    }
  });
}

test('every governed project keeps the desktop hero and rail slots stable', async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto(initialRoute);
  await dismissConsent(page);
  await expectProjectReady(page, initialProject.slug);
  const baseline = await readDesktopState(page);

  for (const project of projects) {
    if (project.slug === initialProject.slug) continue;

    await projectLink(page, project.slug).dispatchEvent('click', { button: 0 });
    await expect(page).toHaveURL(new RegExp(`/projects/${project.slug}$`));
    await expectProjectReady(page, project.slug);
    const current = await readDesktopState(page);

    expectNear(current.heroTop, baseline.heroTop);
    expectNear(current.panelTop, baseline.panelTop);
    expectNear(current.filtersTop, baseline.filtersTop);
    expectNear(current.railTop, baseline.railTop);
    expectNear(current.scrollY, baseline.scrollY, 0.5);
  }
});

test('desktop project selection preserves active rail filters', async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto(initialRoute);
  await dismissConsent(page);
  await expectProjectReady(page, initialProject.slug);
  const main = projectsMain(page);
  const audience = main.getByLabel('Filter by audience');

  await audience.selectOption('residential');
  const resultCount = await main.locator('.project-navigator__result-count').textContent();
  await projectLink(page, targetProject.slug).click();
  await expectProjectReady(page, targetProject.slug);

  await expect(audience).toHaveValue('residential');
  await expect(main.locator('.project-navigator__result-count')).toHaveText(resultCount ?? '');
});

test('the current project remains intact until the incoming hero is decoded', async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  const targetHero = targetProject.caseStudyHeroImage ?? targetProject.heroImage;
  const targetFile = targetHero.src.split('/').at(-1)!;
  let delayedTargetRequest = false;
  let releaseTargetRequest = () => undefined;
  const targetRequestGate = new Promise<void>((resolve) => {
    releaseTargetRequest = resolve;
  });

  await page.route('**/_next/image?*', async (route) => {
    const optimizedSource = decodeURIComponent(
      new URL(route.request().url()).searchParams.get('url') ?? '',
    );
    if (optimizedSource.includes(targetFile)) {
      delayedTargetRequest = true;
      await targetRequestGate;
    }
    await route.continue();
  });

  await page.goto(initialRoute);
  await dismissConsent(page);
  await expectProjectReady(page, initialProject.slug);
  await page.evaluate((incomingFile) => {
    const runtimeWindow = window as Window & {
      __projectSwitchFrames?: Array<{
        complete: boolean;
        currentSrc: string;
        naturalWidth: number;
      }>;
      __stopProjectSwitchFrames?: () => void;
    };
    runtimeWindow.__projectSwitchFrames = [];
    let active = true;
    const sample = () => {
      const image = document.querySelector<HTMLImageElement>(
        '.project-case-study__hero img',
      );
      if (image) {
        runtimeWindow.__projectSwitchFrames?.push({
          complete: image.complete,
          currentSrc: image.currentSrc.includes(incomingFile) ? incomingFile : image.currentSrc,
          naturalWidth: image.naturalWidth,
        });
      }
      if (active) requestAnimationFrame(sample);
    };
    runtimeWindow.__stopProjectSwitchFrames = () => { active = false; };
    requestAnimationFrame(sample);
  }, targetFile);

  await projectLink(page, targetProject.slug).click();
  await expect.poll(() => delayedTargetRequest).toBe(true);
  await expect(page).toHaveURL(new RegExp(`${initialRoute}$`));
  await expect(projectsMain(page).locator('[data-project-case-study]')).toHaveAttribute(
    'data-project-case-study',
    initialProject.slug,
  );
  const oldHero = projectsMain(page).locator('.project-case-study__hero img');
  expect(await oldHero.evaluate(
    (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
  )).toBe(true);

  releaseTargetRequest();
  await expect(page).toHaveURL(new RegExp(`${targetRoute}$`));
  await expectProjectReady(page, targetProject.slug);
  await page.waitForTimeout(50);
  const frames = await page.evaluate(() => {
    const runtimeWindow = window as Window & {
      __projectSwitchFrames?: Array<{
        complete: boolean;
        currentSrc: string;
        naturalWidth: number;
      }>;
      __stopProjectSwitchFrames?: () => void;
    };
    runtimeWindow.__stopProjectSwitchFrames?.();
    return runtimeWindow.__projectSwitchFrames ?? [];
  });
  const incomingFrames = frames.filter(({ currentSrc }) => currentSrc === targetFile);
  expect(incomingFrames.length).toBeGreaterThan(0);
  expect(incomingFrames.every(({ complete, naturalWidth }) => (
    complete && naturalWidth > 0
  ))).toBe(true);
});

test('an off-screen hero realigns under the fixed header without moving the rail', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto(initialRoute);
  await dismissConsent(page);
  await expectProjectReady(page, initialProject.slug);
  await prepareStableRail(page, targetProject.slug);
  await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('.project-case-study__hero');
    if (!hero) throw new Error('Project hero missing');
    window.scrollTo(0, window.scrollY + hero.getBoundingClientRect().bottom + 240);
  });
  const before = await readDesktopState(page);
  expect(before.heroBottom).toBeLessThanOrEqual(before.headerBottom);

  await projectLink(page, targetProject.slug).click();
  await expect(page).toHaveURL(new RegExp(`${targetRoute}$`));
  await expectProjectReady(page, targetProject.slug);
  const after = await readDesktopState(page);

  expectNear(after.heroTop, after.headerBottom);
  expectNear(after.panelTop, before.panelTop);
  expectNear(after.filtersTop, before.filtersTop);
  expectNear(after.railTop, before.railTop);
  expectNear(after.railScrollTop, before.railScrollTop, 0.5);
  expect(after.panelProbe).toBe('preserved');
});

test('modified project clicks retain canonical native-link behavior', async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto(initialRoute);
  await dismissConsent(page);
  await expectProjectReady(page, initialProject.slug);

  const target = projectLink(page, targetProject.slug);
  await expect(target).toHaveAttribute('href', targetRoute);
  const preventedByProjectHandlers = await target.evaluate((anchor) => new Promise<boolean>(
    (resolve) => {
      document.addEventListener('click', (event) => {
        const wasAlreadyPrevented = event.defaultPrevented;
        event.preventDefault();
        resolve(wasAlreadyPrevented);
      }, { once: true });
      anchor.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        button: 0,
        cancelable: true,
        ctrlKey: true,
      }));
    },
  ));

  expect(preventedByProjectHandlers).toBe(false);
  await expect(page).toHaveURL(new RegExp(`${initialRoute}$`));
  await expectProjectReady(page, initialProject.slug);
});

test('mobile keeps the established route navigation and picker behavior', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(initialRoute);
  await dismissConsent(page);
  await expectProjectReady(page, initialProject.slug);
  await expect(page.locator('#project-navigator-panel[role="dialog"]')).toHaveCount(1);

  await projectsMain(page).locator('.project-navigator__trigger').click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  await dialog.locator(`a[href="${targetRoute}"]`).click();

  await expect(page).toHaveURL(new RegExp(`${targetRoute}$`));
  await expectProjectReady(page, targetProject.slug);
  await expect(projectsMain(page).locator('.project-navigator__trigger')).toBeVisible();
  await expect(page.locator('.route-progress')).toHaveClass(/route-progress--idle/);
});

test('canonical project routes and links remain useful without JavaScript', async ({
  browser,
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1_440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}${initialRoute}`);

  await expect(page.locator('[data-project-case-study]')).toHaveAttribute(
    'data-project-case-study',
    initialProject.slug,
  );
  await expect(page.locator(`a[href="${targetRoute}"]`).first()).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${publicOrigin}${initialRoute}`,
  );

  await page.goto(`${baseURL}${targetRoute}`);
  await expect(page.locator('[data-project-case-study]')).toHaveAttribute(
    'data-project-case-study',
    targetProject.slug,
  );
  await expect(page.locator('.project-case-study__hero img')).toBeVisible();
  await context.close();
});
