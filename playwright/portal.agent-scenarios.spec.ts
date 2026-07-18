import { expect, test } from '@playwright/test';

import {
  expectPortalDebugExport,
  openPortalPage,
  withPortalBrowserEvidence,
} from './support/portalAgent';
import {
  getPortalScenarioState,
  loadPortalScenarioState,
  routeForPortalScenario,
} from './support/portalScenarioRegistry';
import { agentScenarioSmokeRoutes } from './support/portalRouteCatalog';

test.describe.configure({ mode: 'serial' });

test('agent can open seeded dynamic portal scenario routes', async ({ page }, testInfo) => {
  await withPortalBrowserEvidence(page, testInfo, { phase: 'agent-scenarios' }, async () => {
    const scenarioState = loadPortalScenarioState();

    for (const routeEntry of agentScenarioSmokeRoutes) {
      const scenario = getPortalScenarioState(scenarioState, routeEntry.scenarioId);
      const route = routeForPortalScenario(routeEntry, scenarioState);

      await openPortalPage(page, route);
      await expect(page, `${routeEntry.id} should stay on the requested portal route family`).not.toHaveURL(/\/login|\/access-status/);

      if (routeEntry.id === 'quote-detail') {
        await expect(page.getByRole('heading', { name: 'Quote', exact: true })).toBeVisible();
        const debugExport = await expectPortalDebugExport(page, 'quote-detail');
        expect(debugExport.selectedIds.projectId).toBe(scenario.projectId);
        expect(debugExport.selectedIds.quoteVersionId).toBe(scenario.quoteVersionId);
      } else if (routeEntry.id === 'design-workbench') {
        await expect(page.getByText('Design Workbench', { exact: true }).first()).toBeVisible();
        await expect(page.getByText(scenario.labels.projectName).first()).toBeVisible();
        const debugExport = await expectPortalDebugExport(page, 'design-workbench');
        expect(debugExport.selectedIds.projectId).toBe(scenario.projectId);
        expect(debugExport.diagnostics.workbenchDebugFixture).toBeTruthy();
      } else if (routeEntry.id === 'calculator') {
        await expect(page.getByRole('heading', { name: 'Calculator', exact: true })).toBeVisible();
        await expect(page.getByText(scenario.labels.projectName).first()).toBeVisible();
        await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
      } else if (routeEntry.id === 'estimate-detail') {
        await expect(page.getByText(scenario.labels.projectName).first()).toBeVisible();
        const debugExport = await expectPortalDebugExport(page, 'estimate-detail');
        expect(debugExport.selectedIds.projectId).toBe(scenario.projectId);
        expect(debugExport.selectedIds.estimateId).toBe(scenario.estimateId);
      } else {
        await expect(page.getByText(scenario.labels.projectName).first()).toBeVisible();
        const debugExport = await expectPortalDebugExport(page, 'project-detail');
        expect(debugExport.selectedIds.projectId).toBe(scenario.projectId);
      }
    }
  });
});
