import { expect, test } from '@playwright/test';
import { projects } from '../apps/marketing/data/projects';
import { products } from '../apps/marketing/data/products';

for (const width of [360, 768, 1440]) {
  test('editorial families preserve populated and incomplete records at ' + width, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/enquiry', route => route.abort());
    const routes = [
      ...projects.map(project => ({ path: '/projects/' + project.slug, kind: 'project', slug: project.slug })),
      ...products.map(product => ({ path: product.route, kind: 'product', slug: product.slug })),
    ];
    for (const route of routes) {
      await page.goto(route.path);
      const main = page.locator('main[data-editorial-page="' + route.kind + '"]');
      await expect(main.locator('h1')).toHaveCount(1);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: route.path }).toBe(true);
      const cta = main.getByRole('link', { name: 'Send project brief', exact: true }).last();
      const href = new URL((await cta.getAttribute('href'))!, 'http://localhost');
      expect(href.searchParams.get('source_' + route.kind)).toBe(route.slug);
      expect(href.searchParams.get('source_path')).toBe(route.path);
      if (route.kind === 'project') {
        const record = projects.find(project => project.slug === route.slug)!;
        const summary = main.locator('dl[data-fact-count]').first();
        const cells = summary.locator(':scope > div');
        await expect(cells).toHaveCount(2 + Number(Boolean(record.stats.width && record.stats.depth)) + Number(Boolean(record.year)));
        await expect(summary).not.toContainText('undefined');
        const edges = await cells.evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
        for (let index = 1; index < edges.length; index++) {
          const previous = edges[index - 1], current = edges[index];
          if (Math.abs(previous.y - current.y) < 1) expect(Math.abs(previous.right - current.x)).toBeLessThan(1);
        }
      } else {
        await expect(main.locator('#roof-approaches')).toHaveCount(route.slug === 'gable' ? 1 : 0);
      }
    }
  });
}
