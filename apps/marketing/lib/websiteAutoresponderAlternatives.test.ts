import { describe, expect, it } from 'vitest';
import {
  WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS,
  isWebsiteAutoresponderPreviewLayout,
  renderWebsiteAutoresponderAlternative,
} from './websiteAutoresponderAlternatives';
import {
  WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS,
  getWebsiteAutoresponderPreviewFixture,
} from './websiteAutoresponderPreviewFixtures';
import { renderWebsiteAutoresponder } from './websiteAutoresponder';
import { resolveWebsiteAutoresponderHero } from './websiteAutoresponderHero';

describe('website autoresponder layout alternatives', () => {
  it('defines exactly three named and validated comparison layouts', () => {
    expect(WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS.map((layout) => layout.id)).toEqual([
      'editorial-refined',
      'image-led',
      'compact',
    ]);
    for (const layout of WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS) {
      expect(isWebsiteAutoresponderPreviewLayout(layout.id)).toBe(true);
      expect(layout.description.length).toBeGreaterThan(40);
      expect(layout.bestFor.length).toBeGreaterThan(30);
    }
    expect(isWebsiteAutoresponderPreviewLayout('current')).toBe(false);
    expect(isWebsiteAutoresponderPreviewLayout('invented')).toBe(false);
  });

  it('renders all three layouts for every one of the 17 governed enquiry fixtures', async () => {
    let renderedCount = 0;
    for (const variant of WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS) {
      const fixture = getWebsiteAutoresponderPreviewFixture(variant);
      const hero = resolveWebsiteAutoresponderHero(fixture.variables);
      const production = await renderWebsiteAutoresponder(
        fixture.templateId,
        fixture.variables as unknown as Record<string, unknown>,
      );

      for (const layout of WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS) {
        const rendered = await renderWebsiteAutoresponderAlternative(
          fixture.templateId,
          fixture.variables as unknown as Record<string, unknown>,
          layout.id,
        );
        renderedCount += 1;

        expect(rendered.layout).toBe(layout.id);
        expect(rendered.subject).toBe(production.subject);
        expect(rendered.preheader).toBe(production.preheader);
        expect(rendered.hero).toEqual(hero);
        expect(rendered.sendSubject).toBe(
          `[Preview: ${layout.name}] ${production.subject}`,
        );
        expect(rendered.html).toContain(hero.imageUrl);
        expect(rendered.html).toContain('name="color-scheme"');
        expect(rendered.html).toContain('content="light dark"');
        expect(rendered.html).toContain(
          '@media (prefers-color-scheme: dark)',
        );
        expect(rendered.html).toContain(
          '@media only screen and (max-width: 620px)',
        );
        expect(rendered.html).toContain('max-width:760px');
        expect(rendered.html).toContain('spx-button');
        expect(rendered.text).toContain('Sanctuary Pergolas');
        expect(rendered.text).toContain('Your project note');
        expect(rendered.text).toContain('Have something useful to add?');
        expect(rendered.text).toContain('Add project information');
        expect(rendered.text).toContain(hero.projectTitle);
        expect(rendered.text).not.toContain('[Preview:');

        if (variant === 'professional') {
          expect(rendered.text).not.toContain('Early installed estimate');
        } else {
          expect(rendered.text).toContain('Early installed estimate');
        }
      }
    }

    expect(renderedCount).toBe(51);
  });

  it('uses genuinely different reading sequences while keeping the same content', async () => {
    const fixture = getWebsiteAutoresponderPreviewFixture(
      'residential-gable-with-blinds',
    );
    const variables =
      fixture.variables as unknown as Record<string, unknown>;
    const [editorial, imageLed, compact] = await Promise.all([
      renderWebsiteAutoresponderAlternative(
        fixture.templateId,
        variables,
        'editorial-refined',
      ),
      renderWebsiteAutoresponderAlternative(
        fixture.templateId,
        variables,
        'image-led',
      ),
      renderWebsiteAutoresponderAlternative(
        fixture.templateId,
        variables,
        'compact',
      ),
    ]);
    expect(editorial.html.indexOf('<h1')).toBeLessThan(
      editorial.html.indexOf('<img'),
    );
    expect(imageLed.html.indexOf('<img')).toBeLessThan(
      imageLed.html.indexOf('<h1'),
    );
    expect(compact.html).toContain('width:56%');
    expect(compact.html).toContain('width:49%');
    expect(new Set([editorial.html, imageLed.html, compact.html]).size).toBe(3);
  });

  it('supports controlled light and dark simulations without changing send HTML', async () => {
    const fixture = getWebsiteAutoresponderPreviewFixture('professional');
    const variables =
      fixture.variables as unknown as Record<string, unknown>;
    const [adaptive, light, dark] = await Promise.all([
      renderWebsiteAutoresponderAlternative(
        fixture.templateId,
        variables,
        'editorial-refined',
      ),
      renderWebsiteAutoresponderAlternative(
        fixture.templateId,
        variables,
        'editorial-refined',
        { previewTheme: 'light' },
      ),
      renderWebsiteAutoresponderAlternative(
        fixture.templateId,
        variables,
        'editorial-refined',
        { previewTheme: 'dark' },
      ),
    ]);

    expect(adaptive.html).not.toContain('class="sp-preview-light"');
    expect(adaptive.html).not.toContain('class="sp-preview-dark"');
    expect(light.html).toContain('class="sp-preview-light"');
    expect(dark.html).toContain('class="sp-preview-dark"');
    expect(light.text).toBe(dark.text);
    expect(adaptive.subject).toBe(light.subject);
  });

  it('does not alter the current production autoresponder template', async () => {
    const fixture = getWebsiteAutoresponderPreviewFixture(
      'residential-pitched-without-blinds',
    );
    const production = await renderWebsiteAutoresponder(
      fixture.templateId,
      fixture.variables as unknown as Record<string, unknown>,
    );

    expect(production.html).not.toContain('sp-preview-light');
    expect(production.html).not.toContain('spx-button');
    expect(production.text.toLowerCase()).toContain(
      'your project starts here.',
    );
    expect(production.text.toLowerCase()).not.toContain(
      'your pergola brief is with us.',
    );
  });
});
