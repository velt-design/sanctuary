import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = [
  { name: 'homepage', path: '/' },
  { name: 'contact', path: '/contact' },
  { name: 'products', path: '/products' },
] as const;

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const;

for (const viewport of viewports) {
  for (const route of routes) {
    test(`${route.name} has no serious accessibility violations on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => {
        window.localStorage.setItem('sp_consent_v1', JSON.stringify({
          analytics: false,
          marketing: false,
          updatedAt: new Date().toISOString(),
          version: 1,
        }));
      });

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${route.name} should load`).toBe(true);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blockingViolations = results.violations.filter(
        ({ impact }) => impact === 'critical' || impact === 'serious',
      );
      const details = blockingViolations
        .map(({ help, id, nodes }) => `${id}: ${help} (${nodes.length} node(s))`)
        .join('\n');

      expect(blockingViolations, details).toEqual([]);
    });
  }
}
