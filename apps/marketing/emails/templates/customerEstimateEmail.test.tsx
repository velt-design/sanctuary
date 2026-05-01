import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';
import { customerEstimateSubject } from '../../lib/sharedEmails';
import { ENQUIRY_HERO_IMAGE_URL } from '../components/HeroImage';
import type { ResidentialOrCommercial } from '../types';
import { CustomerCommercialEmail } from './customerCommercial';
import { CustomerResidentialEmail } from './customerResidential';

const baseLead = {
  leadId: 'enq_123',
  submittedAt: new Date('2026-05-01T00:00:00.000Z'),
  name: 'Alex Morgan',
  email: 'alex@example.com',
  phone: '021 555 0199',
  suburb: 'Ponsonby',
  message: 'Interested in a pergola with lights and heating.',
} as const;

const residential: ResidentialOrCommercial = {
  ...baseLead,
  enquiryType: 'residential',
  widthM: 4.2,
  depthM: 3.6,
  heightM: 2.7,
  style: 'Gable',
  roof: 'Acrylic',
  addons: ['Blinds', 'Lighting'],
  blindsSelected: true,
  baseRange: { lowIncGst: 27500, highIncGst: 31500 },
  blindsRange: { lowIncGst: 7500, highIncGst: 8750 },
};

const commercial: ResidentialOrCommercial = {
  ...baseLead,
  enquiryType: 'commercial',
  widthM: 8.5,
  depthM: 4.2,
  heightM: 3.2,
  style: 'Hip',
  roof: 'Both',
  addons: ['Lighting'],
  blindsSelected: false,
  baseRange: { lowIncGst: 52500, highIncGst: 60500 },
};

describe('customer estimate autoresponder emails', () => {
  it('renders the residential sales hierarchy without the old call promise', async () => {
    const html = await render(CustomerResidentialEmail({ ...residential, callWindowText: 'within 30 minutes' }));
    const text = await render(CustomerResidentialEmail({ ...residential, callWindowText: 'within 30 minutes' }), {
      plainText: true,
    });

    expect(html).toContain(ENQUIRY_HERO_IMAGE_URL);
    expect(text).toContain("Thanks Alex Morgan, we've received your pergola enquiry.");
    expect(text).toContain('Indicative installed investment');
    expect(text).toContain('$27,500 - $31,500');
    expect(text).toContain('Blinds add-on');
    expect(text).toContain('What happens next');
    expect(text).not.toContain('within 30 minutes');
  });

  it('renders the commercial variant and personalized subjects', async () => {
    const text = await render(CustomerCommercialEmail({ ...commercial, callWindowText: 'within 30 minutes' }), {
      plainText: true,
    });

    expect(text).toContain("Thanks Alex Morgan, we've received your commercial pergola enquiry.");
    expect(text).toContain('$52,500 - $60,500');
    expect(text).not.toContain('Blinds add-on');
    expect(text).not.toContain('within 30 minutes');
    expect(customerEstimateSubject('Alex Morgan', 'residential')).toBe(
      'Alex Morgan, your Sanctuary Pergolas estimate is ready',
    );
    expect(customerEstimateSubject('Alex Morgan', 'commercial')).toBe(
      'Alex Morgan, your commercial pergola estimate is ready',
    );
  });
});
