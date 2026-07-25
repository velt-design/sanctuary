import { describe, expect, it } from 'vitest';
import {
  EMAIL_WEBSITE_AUTORESPONDER_COM_V1,
  EMAIL_WEBSITE_AUTORESPONDER_PRO_V1,
  EMAIL_WEBSITE_AUTORESPONDER_RES_V1,
  renderWebsiteAutoresponder,
} from './websiteAutoresponder';
import {
  getWebsiteAutoresponderPreviewFixture,
  WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS,
  type WebsiteAutoresponderPreviewRoofForm,
} from './websiteAutoresponderPreviewFixtures';
import type { ResidentialOrCommercial } from '../emails/types';

const expectedProjectByCustomerAndRoof: Record<
  'residential' | 'commercial',
  Record<WebsiteAutoresponderPreviewRoofForm, { title: string; image: string }>
> = {
  residential: {
    pitched: {
      title: 'Tindalls Bay - Patio & Carport',
      image: '/images/project-tindalls-bay-03.jpg',
    },
    gable: {
      title: 'Warkworth Outdoor Room',
      image: '/images/project-warkworth-outdoor-room-07.jpg',
    },
    'box-perimeter': {
      title: 'Mt Maunganui Box',
      image: '/images/project-mt-maunganui-01.jpg',
    },
    hip: {
      title: 'Muriwai Courtyard',
      image: '/images/project-waitakere-ranges-01.jpg',
    },
  },
  commercial: {
    pitched: {
      title: 'Lilliput Mini Golf',
      image: '/images/project-tamaki-dr-01.jpg',
    },
    gable: {
      title: 'The Good Home Takanini',
      image: '/images/project-goodhome-03.jpg',
    },
    'box-perimeter': {
      title: 'Mt Maunganui Box',
      image: '/images/project-mt-maunganui-01.jpg',
    },
    hip: {
      title: 'Muriwai Courtyard',
      image: '/images/project-waitakere-ranges-01.jpg',
    },
  },
};

describe('website autoresponder preview fixtures', () => {
  it('defines 16 unique customer/roof/blinds fixtures plus professional', () => {
    expect(WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS).toHaveLength(17);
    expect(new Set(WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS).size).toBe(17);
    expect(WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS).toContain(
      'residential-box-perimeter-with-blinds',
    );
    expect(WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS).toContain(
      'commercial-hip-without-blinds',
    );
    expect(WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS).toContain('professional');
  });

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

      if (fixture.selection.customerType === 'professional') {
        expect(fixture.templateId).toBe(EMAIL_WEBSITE_AUTORESPONDER_PRO_V1);
        expect(rendered.subject).toBe("Alex, we've received your project enquiry");
        expect(rendered.text).toContain('KiwiRail Head Office');
        expect(rendered.html).toContain('/images/project-kiwi-rail-01.jpg');
        expect(rendered.text).not.toContain('Indicative installed investment');
        return;
      }

      const { customerType, roofForm, blinds } = fixture.selection;
      const expectedHero = expectedProjectByCustomerAndRoof[customerType][roofForm];
      const variables = fixture.variables as ResidentialOrCommercial;
      const expectedTemplate =
        customerType === 'commercial'
          ? EMAIL_WEBSITE_AUTORESPONDER_COM_V1
          : EMAIL_WEBSITE_AUTORESPONDER_RES_V1;

      expect(fixture.templateId).toBe(expectedTemplate);
      expect(variables.enquiryType).toBe(customerType);
      expect(variables.blindsSelected).toBe(blinds === 'with-blinds');
      expect(rendered.text).toContain('Indicative installed investment');
      expect(rendered.text).toContain(expectedHero.title);
      expect(rendered.html).toContain(expectedHero.image);

      if (blinds === 'with-blinds') {
        expect(rendered.text).toContain('Outdoor blinds');
        expect(variables.blindsRange).toBeDefined();
      } else {
        expect(rendered.text).not.toContain('Outdoor blinds');
        expect(variables.blindsRange).toBeUndefined();
      }
    },
  );

  it('keeps attachments tied to the intended gable fixtures only', async () => {
    const withoutBlinds = getWebsiteAutoresponderPreviewFixture(
      'residential-gable-without-blinds',
    );
    const residentialWithBlinds = getWebsiteAutoresponderPreviewFixture(
      'residential-gable-with-blinds',
    );
    const commercialWithBlinds = getWebsiteAutoresponderPreviewFixture(
      'commercial-gable-with-blinds',
    );

    const withoutBlindsRendered = await renderWebsiteAutoresponder(
      withoutBlinds.templateId,
      withoutBlinds.variables as unknown as Record<string, unknown>,
    );
    const residentialRendered = await renderWebsiteAutoresponder(
      residentialWithBlinds.templateId,
      residentialWithBlinds.variables as unknown as Record<string, unknown>,
    );
    const commercialRendered = await renderWebsiteAutoresponder(
      commercialWithBlinds.templateId,
      commercialWithBlinds.variables as unknown as Record<string, unknown>,
    );

    expect(withoutBlindsRendered.text).not.toContain('Files received with your enquiry');
    expect(residentialRendered.text).toContain('Existing-site-photo.jpg');
    expect(residentialRendered.text).toContain('$7,500 - $8,750');
    expect(commercialRendered.text).toContain('Tenancy-plan.pdf');
    expect(commercialRendered.text).toContain('$14,900 - $17,250');
  });

  it('uses one stable, unique output filename for every fixture', () => {
    const outputNames = WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS.map(
      (variant) => getWebsiteAutoresponderPreviewFixture(variant).fileBaseName,
    );

    expect(new Set(outputNames).size).toBe(17);
    expect(outputNames).toContain('customer-commercial-box-perimeter-with-blinds');
    expect(outputNames).toContain('customer-professional');
  });
});
