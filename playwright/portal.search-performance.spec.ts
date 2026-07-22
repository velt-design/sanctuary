import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  attachPortalBrowserEvidence,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from './support/portalBrowserEvidence';

const API_P75_WITH_DEBOUNCE_MAX_MS = 400;
const CACHED_RESULT_MAX_MS = 75;
const SEARCH_DEBOUNCE_MS = 50;
const DEFAULT_QUERIES = ['an', 're', 'ar', 'jo', 'ma'];
const artifactPath = path.resolve(
  process.cwd(),
  process.env.PORTAL_SEARCH_PERF_ARTIFACT?.trim()
    || 'artifacts/portal-search-performance.json',
);
const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();
let artifact: Record<string, unknown> | null = null;

function percentile75(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.75) - 1)] ?? 0;
}

function parseServerTiming(value: string | undefined): number | null {
  const match = value?.match(/(?:^|,)\s*total;dur=([\d.]+)/i);
  return match ? Number.parseFloat(match[1]) : null;
}

async function installRenderedResultTimer(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-global-portal-search="true"]');
    const input = root?.querySelector<HTMLInputElement>('input[type="search"]');
    if (!root || !input) throw new Error('Global portal search is not mounted.');

    type SearchTimingWindow = Window & typeof globalThis & {
      __portalSearchRenderedTimings?: Record<string, number>;
    };
    const timingWindow = window as SearchTimingWindow;
    timingWindow.__portalSearchRenderedTimings = {};

    input.addEventListener('input', () => {
      const expectedQuery = input.value.trim().toLocaleLowerCase('en-NZ');
      if (expectedQuery.length < 2) return;
      const startedAt = performance.now();
      delete timingWindow.__portalSearchRenderedTimings![expectedQuery];
      let observer: MutationObserver;
      const checkForSettlement = () => {
        const settled = root.dataset.globalSearchResponseQuery === expectedQuery
          && (root.dataset.globalSearchState === 'results' || root.dataset.globalSearchState === 'empty')
          && root.dataset.globalSearchRefreshing === 'false';
        if (!settled) return;
        timingWindow.__portalSearchRenderedTimings![expectedQuery] = performance.now() - startedAt;
        observer.disconnect();
      };
      observer = new MutationObserver(checkForSettlement);
      observer.observe(root, { attributes: true, childList: true, subtree: true });
      queueMicrotask(checkForSettlement);
    });
  });
}

async function renderedResultMs(page: Page, query: string): Promise<number> {
  await expect.poll(async () => page.evaluate((expectedQuery) => {
    type SearchTimingWindow = Window & typeof globalThis & {
      __portalSearchRenderedTimings?: Record<string, number>;
    };
    return (window as SearchTimingWindow).__portalSearchRenderedTimings?.[expectedQuery] ?? null;
  }, query)).not.toBeNull();

  return page.evaluate((expectedQuery) => {
    type SearchTimingWindow = Window & typeof globalThis & {
      __portalSearchRenderedTimings?: Record<string, number>;
    };
    return (window as SearchTimingWindow).__portalSearchRenderedTimings![expectedQuery]!;
  }, query);
}

function searchPayload(query: string, projectName: string) {
  return {
    query,
    projects: [{
      kind: 'project',
      id: `proj_${query}`,
      href: `/staff/projects/proj_${query}`,
      name: projectName,
      reference: 'Q-SEARCH',
      siteAddress: 'Auckland',
      contactName: 'Search QA',
      stage: 'quoting',
      archived: false,
    }],
    contacts: [],
    generatedAt: '2026-07-22T00:00:00.000Z',
  };
}

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (!evidence) return;
  await attachPortalBrowserEvidence(testInfo, page, evidence, {
    routeId: 'portal-search-performance',
    label: testInfo.title,
  });
});

test.afterAll(async () => {
  if (!artifact) return;
  await fs.promises.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.promises.writeFile(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
});

test('serves a cached repeat without a request and keeps results during refresh', async ({ page }) => {
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));

  const requestCounts = new Map<string, number>();
  await page.route('**/api/staff/v1/search?*', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? '';
    requestCounts.set(query, (requestCounts.get(query) ?? 0) + 1);
    await new Promise((resolve) => setTimeout(resolve, query === 'refresh' ? 250 : 150));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(searchPayload(
        query,
        query === 'refresh' ? 'Refreshed Project' : 'Cached Project',
      )),
    });
  });

  await page.goto('/dashboard');
  await expect(page.locator('[data-ui-foundation-consumer="dashboard"]:visible')).toHaveAttribute(
    'data-dashboard-state',
    /^(fresh|refresh-failed)$/,
  );
  const root = page.locator('[data-global-portal-search="true"]:visible');
  const input = page.getByRole('combobox', { name: 'Search projects and contacts' });
  await expect(root).toBeVisible();
  await installRenderedResultTimer(page);

  await input.fill('cache');
  await expect(page.getByRole('option', { name: /Cached Project/ })).toBeVisible();
  expect(requestCounts.get('cache')).toBe(1);

  await input.fill('');
  await expect(root).toHaveAttribute('data-global-search-state', 'idle');
  await input.fill('cache');
  const cachedUiMs = await renderedResultMs(page, 'cache');
  await expect(page.getByRole('option', { name: /Cached Project/ })).toBeVisible();
  expect(requestCounts.get('cache')).toBe(1);
  expect(cachedUiMs).toBeLessThanOrEqual(CACHED_RESULT_MAX_MS);

  await input.fill('refresh');
  await expect(page.getByRole('option', { name: /Cached Project/ })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Updating results' })).toBeVisible();
  await expect(page.getByRole('option', { name: /Refreshed Project/ })).toBeVisible();
  expect(requestCounts.get('refresh')).toBe(1);
});

test('keeps uncached search under 400 ms and cached repeats near-instant', async ({ page }) => {
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));

  const configuredQuery = process.env.PORTAL_SEARCH_PERF_QUERY?.trim().toLocaleLowerCase('en-NZ');
  const uiQuery = configuredQuery && configuredQuery.length >= 2 ? configuredQuery : DEFAULT_QUERIES[0];
  const apiSamples: Array<{ query: string; wallMs: number; serverMs: number | null }> = [];

  for (const query of DEFAULT_QUERIES) {
    const startedAt = performance.now();
    const response = await page.request.get(`/api/staff/v1/search?q=${encodeURIComponent(query)}`);
    const wallMs = performance.now() - startedAt;
    const responseBody = response.ok() ? '' : await response.text();
    expect(
      response.status(),
      `Search API failed for ${query}: ${responseBody || 'empty response'}`,
    ).toBe(200);
    apiSamples.push({
      query,
      wallMs,
      serverMs: parseServerTiming(response.headers()['server-timing']),
    });
  }

  await page.goto('/dashboard');
  await expect(page.locator('[data-ui-foundation-consumer="dashboard"]:visible')).toHaveAttribute(
    'data-dashboard-state',
    /^(fresh|refresh-failed)$/,
  );
  const root = page.locator('[data-global-portal-search="true"]:visible');
  const input = page.getByRole('combobox', { name: 'Search projects and contacts' });
  await expect(root).toBeVisible();
  await expect(input).toBeVisible();
  await installRenderedResultTimer(page);

  let searchRequests = 0;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/staff/v1/search' && url.searchParams.get('q') === uiQuery) {
      searchRequests += 1;
    }
  });

  await input.fill(uiQuery);
  const uncachedUiMs = await renderedResultMs(page, uiQuery);
  await expect(root).toHaveAttribute('data-global-search-response-query', uiQuery);
  expect(searchRequests).toBe(1);

  await input.fill('');
  await expect(root).toHaveAttribute('data-global-search-state', 'idle');
  await input.fill(uiQuery);
  const cachedUiMs = await renderedResultMs(page, uiQuery);
  await expect(root).toHaveAttribute('data-global-search-response-query', uiQuery);
  expect(searchRequests, 'A fresh cached search must not issue a second request.').toBe(1);

  const apiWallP75Ms = percentile75(apiSamples.map((sample) => sample.wallMs));
  const projectedUncachedP75Ms = apiWallP75Ms + SEARCH_DEBOUNCE_MS;
  artifact = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    target: {
      uncachedMsMax: API_P75_WITH_DEBOUNCE_MAX_MS,
      cachedMsMax: CACHED_RESULT_MAX_MS,
      debounceMs: SEARCH_DEBOUNCE_MS,
    },
    apiSamples,
    apiWallP75Ms,
    projectedUncachedP75Ms,
    uncachedUiMs,
    cachedUiMs,
    uiSearchRequests: searchRequests,
  };

  expect(
    projectedUncachedP75Ms,
    `Search API p75 plus debounce was ${projectedUncachedP75Ms.toFixed(1)} ms`,
  ).toBeLessThanOrEqual(API_P75_WITH_DEBOUNCE_MAX_MS);
  expect(uncachedUiMs).toBeLessThanOrEqual(API_P75_WITH_DEBOUNCE_MAX_MS);
  expect(cachedUiMs).toBeLessThanOrEqual(CACHED_RESULT_MAX_MS);
});
