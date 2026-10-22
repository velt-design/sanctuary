import { expect, test } from '@playwright/test';
import {
  beginPortalVisibleDestination,
  portalVisibleDestinationMs,
  retirePortalVisibleDestination,
} from './support/portalVisibleMilestone';

test.beforeEach(async ({ page }) => {
  // A fully local document, with no app, credentials, server or outbound request.
  await page.route('https://portal-clock.example.test/**', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body></body></html>',
  }));
  await page.goto('https://portal-clock.example.test/dashboard');
});

test('latches simultaneous committed conditions, not sequential appearances or expect polling completion', async ({ page }) => {
  await page.setContent('<h1>Contacts</h1><div id="later"></div>');
  const capture = await beginPortalVisibleDestination(page, {
    pathname: '/staff/contacts',
    conditions: [
      { selector: 'h1', text: 'Contacts' },
      { selector: 'section[aria-label="Search contacts"]' },
      { selector: 'section[aria-label="Contacts list"]' },
      { selector: '[data-contacts-index-state]' },
    ],
  });
  const started = Date.now();
  await page.evaluate(() => {
    history.pushState(null, '', '/staff/contacts');
    setTimeout(() => document.querySelector('h1')!.remove(), 60);
    setTimeout(() => document.querySelector('#later')!.innerHTML =
      '<section aria-label="Search contacts">Find</section>', 120);
    setTimeout(() => document.querySelector('#later')!.insertAdjacentHTML('beforeend',
      '<section aria-label="Contacts list">Reading contacts</section><main data-contacts-index-state="loading">Reading</main>'), 220);
    setTimeout(() => {
      document.body.insertAdjacentHTML('afterbegin', '<h1>Contacts</h1>');
      document.body.dataset.committedAt = String(performance.now());
    }, 430);
  });
  // These retain the actual collector's original semantic assertions. The final
  // heading read cannot succeed until after the 350ms expect-poll opportunity.
  await expect(page.getByRole('region', { name: 'Search contacts' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Contacts list' })).toBeVisible();
  await expect(page.locator('[data-contacts-index-state]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible();
  const assertionElapsed = Date.now() - started;
  const observedCommit = await page.evaluate(() => Number(document.body.dataset.committedAt) - window.__portalVisibleDestination!.startedAt);
  const captured = await portalVisibleDestinationMs(page, capture);
  expect(Math.abs(captured - observedCommit)).toBeLessThan(35);
  expect(captured).toBeGreaterThanOrEqual(400);
  expect(captured).toBeLessThan(assertionElapsed);
  console.log(JSON.stringify({ scenario: 'simultaneous-contacts', captured, observedCommit, assertionElapsed }));
});

test('compares the collector with the original Contacts assertion order across an expect polling gap', async ({ page }) => {
  const capture = await beginPortalVisibleDestination(page, {
    pathname: '/staff/contacts', conditions: [
      { selector: 'h1', text: 'Contacts' },
      { selector: 'section[aria-label="Search contacts"]' },
      { selector: 'section[aria-label="Contacts list"]' },
      { selector: '[data-contacts-index-state]' },
    ],
  });
  const started = Date.now();
  await page.evaluate(() => {
    history.pushState(null, '', '/staff/contacts');
    setTimeout(() => {
      document.body.innerHTML = '<h1>Contacts</h1><section aria-label="Search contacts">Find</section>' +
        '<section aria-label="Contacts list">Reading</section><main data-contacts-index-state="loading">Reading</main>';
      document.body.dataset.committedAt = String(performance.now());
    }, 430);
  });
  await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Search contacts' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Contacts list' })).toBeVisible();
  await expect(page.locator('[data-contacts-index-state]')).toBeVisible();
  const assertionElapsed = Date.now() - started;
  const observedCommit = await page.evaluate(() => Number(document.body.dataset.committedAt) - window.__portalVisibleDestination!.startedAt);
  const captured = await portalVisibleDestinationMs(page, capture);
  expect(Math.abs(captured - observedCommit)).toBeLessThan(35);
  expect(assertionElapsed).toBeGreaterThan(captured);
  console.log(JSON.stringify({ scenario: 'original-contacts-assertions', captured, observedCommit, assertionElapsed }));
});

for (const hidden of ['display:none', 'visibility:hidden', 'content-visibility:hidden', 'width:0;height:0;overflow:hidden']) {
  test(`matches Playwright visibility for ${hidden}`, async ({ page }) => {
    const zeroBox = hidden.startsWith('width:0');
    await page.setContent(zeroBox
      ? `<section id="owner" style="${hidden}"></section>`
      : `<div id="ancestor" style="${hidden}"><section id="owner">Actual owner</section></div>`);
    const capture = await beginPortalVisibleDestination(page, {
      pathname: '/dashboard', conditions: [{ selector: '#owner' }],
    });
    await expect(page.locator('#owner')).not.toBeVisible();
    await page.evaluate(() => new Promise<void>((resolve) => setTimeout(() => {
      if (document.querySelector('#ancestor')) document.querySelector('#ancestor')!.removeAttribute('style');
      else document.querySelector('#owner')!.setAttribute('style', 'width:100px;height:20px');
      document.body.dataset.committedAt = String(performance.now());
      resolve();
    }, 100)));
    await expect(page.locator('#owner')).toBeVisible();
    const commit = await page.evaluate(() => Number(document.body.dataset.committedAt) - window.__portalVisibleDestination!.startedAt);
    const captured = await portalVisibleDestinationMs(page, capture);
    expect(Math.abs(captured - commit)).toBeLessThan(35);
    expect(captured).toBeGreaterThanOrEqual(90);
  });
}

test('preserves nonzero display:contents visibility and exact heading text/level at the destination', async ({ page }) => {
  await page.setContent('<h2>Work Queue</h2><div data-project-work-queue-state="fresh">Old card</div>');
  const capture = await beginPortalVisibleDestination(page, {
    pathname: '/staff/projects/work-queue', conditions: [
      { selector: 'h1', text: 'Work Queue' },
      { selector: '[data-project-work-queue-state]' },
      { selector: '#contents' },
    ],
  });
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<h1>Work Queue old</h1><div id="contents" style="display:contents"><span>Actual controls</span></div>');
    setTimeout(() => {
      history.pushState(null, '', '/staff/projects/work-queue');
      document.querySelector('h1')!.textContent = 'Work   Queue';
      document.body.dataset.committedAt = String(performance.now());
    }, 100);
  });
  await expect(page.locator('#contents')).toBeVisible();
  const captured = await portalVisibleDestinationMs(page, capture);
  expect(captured).toBeGreaterThanOrEqual(90);
  await expect(page.getByRole('heading', { name: 'Work Queue', exact: true, level: 1 })).toBeVisible();
});

for (const scenario of [
  { name: 'visible direct text', owner: '', ancestor: '', playwrightVisible: true, hidden: false },
  { name: 'own visibility hidden', owner: 'visibility:hidden', ancestor: '', playwrightVisible: true, hidden: true },
  { name: 'inherited visibility hidden', owner: '', ancestor: 'visibility:hidden', playwrightVisible: true, hidden: true },
  { name: 'own content visibility hidden', owner: 'content-visibility:hidden', ancestor: '', playwrightVisible: true, hidden: true },
  { name: 'ancestor content visibility hidden', owner: '', ancestor: 'content-visibility:hidden', playwrightVisible: true, hidden: true },
  { name: 'own display none', owner: 'display:none', ancestor: '', playwrightVisible: false, hidden: true },
  { name: 'ancestor display none', owner: '', ancestor: 'display:none', playwrightVisible: false, hidden: true },
]) {
  test(`compares installed locator and fail-closed contents capture: ${scenario.name}`, async ({ page }) => {
    await page.setContent(`<div id="ancestor" style="${scenario.ancestor}"><div id="owner" style="display:contents;${scenario.owner}">Actual text</div></div>`);
    // Installed Playwright's Range fallback sees boxes even for these hidden
    // direct-text cases. Record that quirk rather than silently assuming parity.
    expect(await page.locator('#owner').isVisible()).toBe(scenario.playwrightVisible);
    const capture = await beginPortalVisibleDestination(page, {
      pathname: '/dashboard', conditions: [{ selector: '#owner' }],
    });
    await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
    if (scenario.hidden) {
      expect(await page.evaluate(() => window.__portalVisibleDestination?.completedAt)).toBeNull();
      await page.evaluate(() => {
        document.querySelector('#ancestor')!.removeAttribute('style');
        document.querySelector('#owner')!.setAttribute('style', 'display:contents');
        document.body.dataset.committedAt = String(performance.now());
      });
      await expect(page.locator('#owner')).toBeVisible();
      const commit = await page.evaluate(() => Number(document.body.dataset.committedAt) - window.__portalVisibleDestination!.startedAt);
      const captured = await portalVisibleDestinationMs(page, capture);
      expect(Math.abs(captured - commit)).toBeLessThan(35);
      expect(captured).toBeGreaterThanOrEqual(90);
    } else {
      // Delayed retrieval must retain the already-visible direct text's timestamp.
      expect(await portalVisibleDestinationMs(page, capture)).toBeLessThan(100);
    }
  });
}

test('detects history-only destination adoption and keeps the timestamp when retrieved late', async ({ page }) => {
  await page.setContent('<h1>Dashboard</h1>');
  const capture = await beginPortalVisibleDestination(page, {
    pathname: '/staff/projects', conditions: [{ selector: 'h1', text: 'Dashboard' }],
  });
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(() => {
    history.pushState(null, '', '/staff/projects');
    document.body.dataset.committedAt = String(performance.now());
    setTimeout(resolve, 300);
  }, 100)));
  const commit = await page.evaluate(() => Number(document.body.dataset.committedAt) - window.__portalVisibleDestination!.startedAt);
  const captured = await portalVisibleDestinationMs(page, capture);
  expect(Math.abs(captured - commit)).toBeLessThan(35);
  expect(captured).toBeLessThan(300);
  expect(await page.evaluate(() => window.__portalVisibleDestination)).toBeUndefined();
});

for (const markup of [
  '<h1 aria-label="Other page">Projects</h1>',
  '<h1 aria-labelledby="label">Projects</h1><span id="label">Other page</span>',
  '<div aria-hidden="true"><h1>Projects</h1></div>',
  '<h1><span aria-hidden="true">Projects</span></h1>',
]) {
  test(`does not replace a heading's accessible name with textContent: ${markup}`, async ({ page }) => {
    await page.setContent(markup);
    const capture = await beginPortalVisibleDestination(page, {
      pathname: '/dashboard', conditions: [{ selector: 'h1', text: 'Projects' }],
    });
    await expect(page.getByRole('heading', { name: 'Projects', exact: true, level: 1 })).toHaveCount(0);
    await page.evaluate(() => new Promise<void>((resolve) => setTimeout(() => {
      document.body.innerHTML = '<h1>Projects</h1>';
      document.body.dataset.committedAt = String(performance.now());
      resolve();
    }, 100)));
    await expect(page.getByRole('heading', { name: 'Projects', exact: true, level: 1 })).toBeVisible();
    const commit = await page.evaluate(() => Number(document.body.dataset.committedAt) - window.__portalVisibleDestination!.startedAt);
    const captured = await portalVisibleDestinationMs(page, capture);
    expect(Math.abs(captured - commit)).toBeLessThan(35);
    expect(captured).toBeGreaterThanOrEqual(90);
  });
}

test('times out without a partial match and retires the observer', async ({ page }) => {
  await page.setContent('<h1>Projects</h1>');
  const capture = await beginPortalVisibleDestination(page, {
    pathname: '/dashboard', conditions: [{ selector: 'h1' }, { selector: '[data-missing-owner]' }],
  }, 100);
  await expect(portalVisibleDestinationMs(page, capture)).rejects.toThrow('did not become simultaneously visible');
  expect(await page.evaluate(() => window.__portalVisibleDestination)).toBeUndefined();
});

test('replacement and explicit cleanup cannot reuse or retire another journey capture', async ({ page }) => {
  await page.setContent('<h1>Projects</h1>');
  const first = await beginPortalVisibleDestination(page, {
    pathname: '/dashboard', conditions: [{ selector: '[data-never]' }],
  });
  const second = await beginPortalVisibleDestination(page, {
    pathname: '/dashboard', conditions: [{ selector: 'h1', text: 'Projects' }],
  });
  await expect(portalVisibleDestinationMs(page, first)).rejects.toThrow('replaced or retired');
  expect(await page.evaluate(() => window.__portalVisibleDestination?.id)).toBe(second);
  await portalVisibleDestinationMs(page, second);
  const third = await beginPortalVisibleDestination(page, {
    pathname: '/dashboard', conditions: [{ selector: '[data-never]' }],
  });
  await retirePortalVisibleDestination(page, third);
  await expect(portalVisibleDestinationMs(page, third)).rejects.toThrow('replaced or retired');
  expect(await page.evaluate(() => window.__portalVisibleDestination)).toBeUndefined();
});
