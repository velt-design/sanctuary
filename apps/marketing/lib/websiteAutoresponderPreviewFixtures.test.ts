import { describe, expect, it } from 'vitest';
import {
  EMAIL_WEBSITE_AUTORESPONDER_PRO_V1,
  renderWebsiteAutoresponder,
} from './websiteAutoresponder';
import {
  getWebsiteAutoresponderPreviewFixture,
  WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS,
} from './websiteAutoresponderPreviewFixtures';

describe('website autoresponder preview fixtures', () => {
  it.each(WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS)(
    'renders the exact production contract for %s',
    async (variant) => {
      const fixture = getWebsiteAutoresponderPreviewFixture(variant);
      const rendered = await renderWebsiteAutoresponder(
        fixture.templateId,
        fixture.variables as unknown as Record<string, unknown>,
      );

      expect(rendered.subject).toContain('Alex');
      expect(rendered.preheader).toContain('Sanctuary');
      expect(rendered.html).toContain('Sanctuary');
      expect(rendered.text).toContain('Project details received');
      expect(rendered.text).not.toContain('within 30 minutes');

      if (fixture.templateId === EMAIL_WEBSITE_AUTORESPONDER_PRO_V1) {
        expect(rendered.subject).toBe("Alex, we've received your project enquiry");
        expect(rendered.text).not.toContain('Indicative installed investment');
        return;
      }

      expect(rendered.text).toContain('Indicative installed investment');
    },
  );

  it('keeps blinds and attachment sections tied to the selected fixture only', async () => {
    const residentialWithoutBlinds = getWebsiteAutoresponderPreviewFixture(
      'residential-no-blinds',
    );
    const commercialWithBlinds = getWebsiteAutoresponderPreviewFixture(
      'commercial-with-blinds',
    );

    const withoutBlinds = await renderWebsiteAutoresponder(
      residentialWithoutBlinds.templateId,
      residentialWithoutBlinds.variables as unknown as Record<string, unknown>,
    );
    const withBlinds = await renderWebsiteAutoresponder(
      commercialWithBlinds.templateId,
      commercialWithBlinds.variables as unknown as Record<string, unknown>,
    );

    expect(withoutBlinds.text).not.toContain('Outdoor blinds');
    expect(withoutBlinds.text).not.toContain('Files received with your enquiry');
    expect(withBlinds.text).toContain('Outdoor blinds');
    expect(withBlinds.text).toContain('$14,900 - $17,250');
    expect(withBlinds.text).toContain('Tenancy-plan.pdf');
  });
});
