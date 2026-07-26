import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

type MobileViewport = {
  height: number;
  name: string;
  width: number;
};

const hydrationCases = [
  {
    path: '/pergolas-auckland',
    selector: 'details[data-mobile-content-disclosure]',
  },
  {
    path: '/products/pergolas/gable',
    selector: 'details[data-product-mobile-disclosure]',
  },
  {
    path: '/pergola-cost-auckland',
    selector: 'details[data-guide-supporting-depth]',
  },
  {
    path: '/projects/warkworth-outdoor-room',
    selector: 'details[data-project-mobile-disclosure]',
  },
] as const;
const capturePath = '/pergolas-auckland';

const phaseOneEvidenceDirectory = path.join(
  process.cwd(),
  'artifacts',
  'mobile-ux-phase-1',
);

export async function expectStableDisclosureHydration(
  page: Page,
  viewports: readonly MobileViewport[],
  captureEvidence: boolean,
) {
  if (captureEvidence) {
    await mkdir(phaseOneEvidenceDirectory, { recursive: true });
  }

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const hydrationCase of hydrationCases) {
      await page.route('**/*', async (route) => {
        if (route.request().resourceType() === 'script') {
          await route.abort();
          return;
        }
        await route.continue();
      });
      await page.goto(hydrationCase.path, { waitUntil: 'load' });

      const pending = page.locator(hydrationCase.selector).first();
      const pendingBody = pending.locator(':scope > div');
      await expect(pending).toHaveAttribute('data-disclosure-state', 'pending');
      await expect(pending).toHaveAttribute('open', '');
      await expect(pendingBody).toBeHidden();
      expect(
        await pendingBody
          .locator('a, button, input, select, textarea, [tabindex]')
          .evaluateAll((elements) =>
            elements.every((element) => element.getClientRects().length === 0),
          ),
      ).toBe(true);
      const pendingHeight = await pending.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      if (captureEvidence && hydrationCase.path === capturePath) {
        await pending.screenshot({
          path: path.join(
            phaseOneEvidenceDirectory,
            `disclosure-prehydration-${viewport.width}.png`,
          ),
        });
      }

      await page.unrouteAll({ behavior: 'wait' });
      await page.reload({ waitUntil: 'load' });

      const hydrated = page.locator(hydrationCase.selector).first();
      const hydratedBody = hydrated.locator(':scope > div');
      await expect(hydrated).toHaveAttribute('data-disclosure-state', 'mobile');
      await expect(hydrated).not.toHaveAttribute('open', '');
      await expect(hydratedBody).toBeHidden();
      const hydratedHeight = await hydrated.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      if (captureEvidence && hydrationCase.path === capturePath) {
        await hydrated.screenshot({
          path: path.join(
            phaseOneEvidenceDirectory,
            `disclosure-hydrated-${viewport.width}.png`,
          ),
        });
      }

      expect(
        Math.abs(hydratedHeight - pendingHeight),
        `${hydrationCase.path} should not collapse after hydration at ${viewport.name}`,
      ).toBeLessThanOrEqual(1);
    }
  }
}
