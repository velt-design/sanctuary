import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  attachPortalBrowserEvidence,
  capturePortalEvidenceScreenshot,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from './support/portalBrowserEvidence';

const evidenceDir = path.resolve(process.cwd(), 'artifacts/ui-foundation-schedule-tasks');
fs.mkdirSync(evidenceDir, { recursive: true });
const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();
test.describe.configure({ mode: 'serial' });

const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const;

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (evidence) {
    await attachPortalBrowserEvidence(testInfo, page, evidence, {
      routeId: 'schedule-tasks-foundation-ui',
      label: testInfo.title,
    });
  }
});

async function expectNoDocumentOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
}

async function expectNoLegacyRoundedSurfaces(root: Locator) {
  const offenders = await root.locator('*:visible').evaluateAll((elements) => elements.flatMap((element) => {
    const style = getComputedStyle(element);
    const radius = Number.parseFloat(style.borderRadius);
    const rect = element.getBoundingClientRect();
    const isSmallCircle = Math.abs(rect.width - rect.height) < 1 && rect.width <= 24;
    if (!Number.isFinite(radius) || radius <= 4 || isSmallCircle || element.tagName.toLowerCase() === 'svg') return [];
    return [{ tag: element.tagName, className: element.className, radius: style.borderRadius }];
  }).slice(0, 20));
  expect(offenders).toEqual([]);
}

async function openSchedule(page: Page, view: 'board' | 'gantt' | 'site-visits' = 'board') {
  await page.goto('about:blank');
  await page.goto(`/staff/schedule${view === 'board' ? '' : `?view=${view}`}`);
  await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-ui-foundation-consumer="schedule"]:visible')).toHaveCount(1, { timeout: 60_000 });
  if (view === 'board') {
    await expect(page.getByRole('button', { name: /Collapse unscheduled panel|Expand unscheduled panel/ })).toBeVisible({ timeout: 60_000 });
  } else if (view === 'gantt') {
    const compact = await page.evaluate(() => window.innerWidth <= 640);
    await expect(page.locator(compact ? '[aria-label="Crew schedule agenda"]' : '[aria-label="Gantt timeline"]'))
      .toBeVisible({ timeout: 60_000 });
  } else {
    await expect(page.getByRole('region', { name: 'Site visits calendar' })).toBeVisible({ timeout: 60_000 });
  }
}

test('Schedule foundation presentation is responsive and non-mutating', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (request) => request.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openSchedule(page);
    await expect(page.getByRole('button', { name: 'Board', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /Collapse unscheduled panel|Expand unscheduled panel/ })).toBeVisible();
    await expectNoDocumentOverflow(page);
    const boardGeometry = await page.locator('[data-board-lanes="true"]').evaluate((lanes) => {
      const laneRegions = Array.from(lanes.querySelectorAll<HTMLElement>('[data-board-lane-id]'));
      const laneBodies = Array.from(lanes.querySelectorAll<HTMLElement>('[data-board-lane-body]'));
      return {
        laneCount: laneRegions.length,
        laneTops: Array.from(new Set(laneRegions.map((lane) => Math.round(lane.getBoundingClientRect().top)))),
        lanesClientWidth: lanes.clientWidth,
        lanesScrollWidth: lanes.scrollWidth,
        laneBodyHasHorizontalOverflow: laneBodies.some((body) => body.scrollWidth > body.clientWidth + 1),
      };
    });
    expect(boardGeometry.laneBodyHasHorizontalOverflow).toBe(false);
    if (viewport.width > 760) {
      expect(boardGeometry.lanesScrollWidth).toBeLessThanOrEqual(boardGeometry.lanesClientWidth + 1);
      if (boardGeometry.laneCount > 4) expect(boardGeometry.laneTops.length).toBeGreaterThan(1);
    } else if (boardGeometry.laneCount > 1) {
      expect(boardGeometry.lanesScrollWidth).toBeGreaterThan(boardGeometry.lanesClientWidth);
    }
    await expectNoLegacyRoundedSurfaces(page.locator('[data-ui-foundation-consumer="schedule"]:visible'));
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `schedule-board-${viewport.name}.png`),
      fullPage: viewport.width < 1120,
    });
  }

  const jobActions = page.getByRole('button', { name: /^Job actions for / }).first();
  await jobActions.click();
  const actionsPanel = page.getByRole('dialog', { name: /^Job actions for / });
  await expect(actionsPanel).toBeVisible();
  await expect(actionsPanel.getByRole('heading', { name: /Plan and timing|Exceptions/ }).first()).toBeVisible();
  await expect(actionsPanel.getByRole('button', { name: /Extend \+[12] day/ })).toHaveCount(0);
  await expect(actionsPanel.getByRole('menuitem')).toHaveCount(0);
  const firstSafeJobAction = actionsPanel.getByRole('button', {
    name: /^(Lock schedule|Reschedule|Pin|Set duration|Add delay|Set days remaining)/,
  }).first();
  await firstSafeJobAction.click();
  const actionDialog = page.getByRole('dialog').last();
  await expect(actionDialog).toBeVisible();
  await expect(actionDialog).toHaveAttribute('data-modal-panel', 'true');
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(actionDialog);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'schedule-action-dialog-390x844.png'),
  });
  await page.keyboard.press('Escape');
  await expect(actionDialog).toHaveCount(0);
  await expect(jobActions).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await openSchedule(page);
  const eightCrewGeometry = await page.locator('[data-board-lanes="true"]').evaluate(async (lanes) => {
    const originalCount = lanes.getAttribute('data-visible-crew-count');
    const originals = Array.from(lanes.querySelectorAll<HTMLElement>(':scope > [data-board-lane-id]'));
    if (originals.length === 0) return null;
    const extras = originals.slice(8);
    const extraHiddenStates = extras.map((lane) => lane.hidden);
    extras.forEach((lane) => {
      lane.hidden = true;
    });

    const clones: HTMLElement[] = [];
    for (let index = originals.length; index < 8; index += 1) {
      const clone = originals[index % originals.length].cloneNode(true) as HTMLElement;
      clone.setAttribute('data-board-lane-id', `layout-proof-${index + 1}`);
      clone.setAttribute('aria-label', `Lane layout proof ${index + 1}`);
      clones.push(clone);
      lanes.appendChild(clone);
    }
    lanes.setAttribute('data-visible-crew-count', '8');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const laneRect = lanes.getBoundingClientRect();
    const laneRegions = Array.from(lanes.querySelectorAll<HTMLElement>(':scope > [data-board-lane-id]')).filter((lane) => !lane.hidden);
    const result = {
      laneCount: laneRegions.length,
      laneTops: Array.from(new Set(laneRegions.map((lane) => Math.round(lane.getBoundingClientRect().top)))),
      lanesClientWidth: lanes.clientWidth,
      lanesScrollWidth: lanes.scrollWidth,
      allInsideGrid: laneRegions.every((lane) => {
        const rect = lane.getBoundingClientRect();
        return rect.left >= laneRect.left - 1 && rect.right <= laneRect.right + 1;
      }),
    };

    clones.forEach((clone) => clone.remove());
    extras.forEach((lane, index) => {
      lane.hidden = extraHiddenStates[index];
    });
    if (originalCount === null) lanes.removeAttribute('data-visible-crew-count');
    else lanes.setAttribute('data-visible-crew-count', originalCount);
    return result;
  });
  if (eightCrewGeometry) {
    expect(eightCrewGeometry.laneCount).toBe(8);
    expect(eightCrewGeometry.laneTops).toHaveLength(2);
    expect(eightCrewGeometry.lanesScrollWidth).toBeLessThanOrEqual(eightCrewGeometry.lanesClientWidth + 1);
    expect(eightCrewGeometry.allInsideGrid).toBe(true);
  }

  const crewFilterTrigger = page.locator('summary[aria-label^="Filter crews"]');
  let filteredCrewId: string | null = null;
  if ((await crewFilterTrigger.count()) > 0) {
    await crewFilterTrigger.click();
    const crewChoices = page.getByRole('group', { name: 'Choose visible crews' }).getByRole('checkbox');
    const initialCrewCount = await crewChoices.count();
    if (initialCrewCount > 0) {
      const crewChoice = crewChoices.last();
      const crewId = await crewChoice.getAttribute('data-crew-id');
      expect(crewId).toBeTruthy();
      filteredCrewId = crewId;
      await crewChoice.uncheck();
      await expect(page.locator(`[data-board-lane-id="${crewId}"]`)).toHaveCount(0);

      await openSchedule(page, 'gantt');
      await expect(page.locator(`[data-gantt-crew-id="${crewId}"]`)).toHaveCount(0);
      await crewFilterTrigger.click();
      await expect(page.locator(`input[data-crew-id="${crewId}"]`)).not.toBeChecked();
      await page.getByRole('button', { name: 'Show all', exact: true }).click();
      await expect(page.locator(`[data-gantt-crew-id="${crewId}"]`)).toHaveCount(1);

      await openSchedule(page);
      await expect(page.locator(`[data-board-lane-id="${crewId}"]`)).toHaveCount(1);
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await openSchedule(page, 'gantt');
  await expect(page.getByRole('button', { name: 'Gantt', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[aria-label="Gantt timeline"]')).toBeVisible();
  await expect(page.getByLabel('Timeline scale')).toHaveValue('8');
  await expect(page.getByRole('group', { name: 'Timeline controls' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'View options' })).toBeVisible();
  await expect(page.locator('[data-gantt-current-week="true"]')).toBeVisible();
  if (filteredCrewId) {
    await expect(page.locator(`[data-gantt-crew-id="${filteredCrewId}"]`)).toHaveCount(1);
  }
  const ganttOverflow = await page.locator('[aria-label="Gantt timeline"]').evaluate((timeline) => ({
    clientWidth: timeline.clientWidth,
    scrollWidth: timeline.scrollWidth,
  }));
  expect(ganttOverflow.scrollWidth).toBeGreaterThan(ganttOverflow.clientWidth);

  const attentionButton = page.getByRole('button', { name: /Needs attention/ });
  const attentionCount = Number.parseInt((await attentionButton.textContent())?.match(/\d+/)?.[0] ?? '0', 10);
  await attentionButton.click();
  await expect(attentionButton).toHaveAttribute('aria-pressed', 'true');
  if (attentionCount > 0) {
    const visibleAttentionRows = page.locator('[data-gantt-schedule-item-id]');
    await expect(visibleAttentionRows.first()).toBeVisible();
    expect(await visibleAttentionRows.evaluateAll((rows) =>
      rows.every((row) => row.getAttribute('data-needs-attention') === 'true'),
    )).toBe(true);
  } else {
    await expect(page.getByRole('status', { name: 'Gantt empty state' })).toContainText('Nothing needs attention');
  }
  await page.getByRole('button', { name: 'All jobs', exact: true }).click();
  await expect(page.getByRole('button', { name: 'All jobs', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(page.locator('[data-ui-foundation-consumer="schedule"]:visible'));
  await capturePortalEvidenceScreenshot(page, { path: path.join(evidenceDir, 'schedule-gantt-1440x1000.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await openSchedule(page, 'gantt');
  await expect(page.locator('[aria-label="Gantt timeline"]')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Crew schedule agenda' })).toBeVisible();
  await expect(page.getByText('Read-only here. Open Board to safely move, reorder or unschedule work.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Board and unscheduled work' })).toBeVisible();
  const mobileGanttTargets = await page
    .getByLabel('Small-screen schedule controls')
    .locator('button:visible, summary:visible')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        label: element.textContent?.trim(),
        height: element.getBoundingClientRect().height,
      })),
    );
  expect(mobileGanttTargets.filter((target) => target.label && target.height < 43)).toEqual([]);
  const compactAgendaGeometry = await page.getByRole('region', { name: 'Crew schedule agenda' }).evaluate((agenda) => ({
    clientHeight: agenda.clientHeight,
    scrollHeight: agenda.scrollHeight,
  }));
  expect(compactAgendaGeometry.clientHeight).toBeGreaterThan(180);
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'schedule-gantt-390x844.png'),
    fullPage: true,
  });

  for (const viewport of [viewports[0], viewports[4]]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openSchedule(page, 'site-visits');
    await expect(page.getByRole('button', { name: 'Site visits', exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Site visits calendar' })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(page.locator('[data-ui-foundation-consumer="schedule"]:visible'));
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `schedule-site-visits-${viewport.name}.png`),
      fullPage: viewport.width < 1120,
    });
  }

  const slot = page.locator('main[aria-label="Site visits week calendar"] button[aria-label$="09:00"]').first();
  await slot.click();
  const slotDialog = page.getByRole('dialog', { name: 'Select site visit' });
  await expect(slotDialog).toBeVisible();
  await slotDialog.getByRole('button', { name: 'Create site visit (no project)' }).click();
  const siteVisitDialog = page.getByRole('dialog', { name: 'New site visit' });
  await expect(siteVisitDialog).toBeVisible();
  await expect(siteVisitDialog.getByText('Visit / Project', { exact: true })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(siteVisitDialog);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'schedule-site-visit-create-390x844.png'),
  });
  await siteVisitDialog.getByRole('button', { name: 'Discard' }).click();
  await expect(siteVisitDialog).toHaveCount(0);

  await page.setViewportSize({ width: 720, height: 500 });
  await openSchedule(page);
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'schedule-board-720x500-zoom-200.png'),
    fullPage: true,
  });
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });

  await page.setViewportSize({ width: 390, height: 844 });
  await openSchedule(page);
  const headerTargets = await page.locator('header button:visible, [data-ui-foundation-consumer="schedule"] > div:first-of-type button:visible').evaluateAll((elements) =>
    elements.map((element) => ({ label: element.textContent?.trim(), height: element.getBoundingClientRect().height })),
  );
  expect(headerTargets.filter((target) => target.label && target.height < 43)).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await page.locator('[data-ui-foundation-consumer="schedule"]').evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(motion.split(',').every((duration) => duration.trim() === '0s')).toBe(true);

  expect(
    evidence.consoleMessages.filter(
      (message) => !message.text.includes('[project_work] V2 marker schema is unavailable; using pre-rollout legacy compatibility.'),
    ),
  ).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});
