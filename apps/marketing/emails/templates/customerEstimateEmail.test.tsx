import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';
import {
  customerEstimatePreheader,
  PROFESSIONAL_ENQUIRY_PREHEADER,
} from '../customerAutoresponderCopy';
import {
  customerEstimateSubject,
  professionalEnquirySubject,
} from '../../lib/sharedEmails';
import { ENQUIRY_HERO_IMAGE_URL } from '../components/HeroImage';
import { INVESTMENT_PANEL_BACKGROUND } from '../components/InvestmentPanel';
import type { Professional, ResidentialOrCommercial } from '../types';
import { CustomerCommercialEmail } from './customerCommercial';
import { CustomerProfessionalEmail } from './customerProfessional';
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
  baseRange: { lowIncGst: 27500, highIncGst: 27500 },
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
  baseRange: { lowIncGst: 52500, highIncGst: 52500 },
};

const professional: Professional = {
  ...baseLead,
  enquiryType: 'professional',
  company: 'Studio North Architects',
  filesReceivedCount: 2,
};

describe('customer estimate autoresponder emails', () => {
  it('renders the residential editorial hierarchy and responsive email shell without a response-time promise', async () => {
    const html = await render(CustomerResidentialEmail({ ...residential, callWindowText: 'within 30 minutes' }));
    const text = await render(CustomerResidentialEmail({ ...residential, callWindowText: 'within 30 minutes' }), {
      plainText: true,
    });
    const normalizedText = text.toLowerCase();

    expect(html).toContain(ENQUIRY_HERO_IMAGE_URL);
    expect(html).not.toContain('email-logo.png');
    expect(html).toContain(INVESTMENT_PANEL_BACKGROUND);
    expect(html).toContain('max-width:640px');
    expect(normalizedText).toContain('sanctuary');
    expect(text).toContain('Bespoke pergolas, built around the architecture.');
    expect(normalizedText).toContain('residential enquiry · received');
    expect(normalizedText).toContain('thanks, alex morgan. your project starts here.');
    expect(text).toContain("We've received the outline for your Ponsonby project.");
    expect(text).toContain('Indicative installed investment');
    expect(text).toContain('$27,500');
    expect(text).not.toContain('$27,500 - $27,500');
    expect(text).toContain('Outdoor blinds');
    expect(text).toContain('What happens next');
    expect(text).toContain('We review the brief');
    expect(text).toContain('We clarify the site');
    expect(text).toContain('We shape the proposal');
    expect(text).toContain('Project details received');
    expect(text).toContain('Approximate dimensions');
    expect(text).toContain('Add anything useful.');
    expect(text).toContain('Reply to Sanctuary');
    expect(text).toContain('This is an early guide, not a quote.');
    expect(text).not.toContain('within 30 minutes');
    expect(text).not.toContain('shortly');
  });

  it('renders the commercial hierarchy with the customer subject and preheader', async () => {
    const text = await render(CustomerCommercialEmail({ ...commercial, callWindowText: 'within 30 minutes' }), {
      plainText: true,
    });

    expect(text.toLowerCase()).toContain('commercial enquiry · received');
    expect(text).toContain('We clarify the interfaces');
    expect(text).toContain('Project area');
    expect(text).toContain('$52,500');
    expect(text).not.toContain('$52,500 - $52,500');
    expect(text).not.toContain('Outdoor blinds');
    expect(text).not.toContain('within 30 minutes');
    expect(customerEstimateSubject('Alex Morgan', 'residential')).toBe(
      "Alex, we've received your pergola enquiry",
    );
    expect(customerEstimateSubject('Alex Morgan', 'commercial')).toBe(
      "Alex, we've received your commercial pergola enquiry",
    );
    expect(customerEstimatePreheader('commercial', commercial.baseRange)).toBe(
      'Your commercial project details, indicative installed estimate and the next steps from Sanctuary.',
    );
  });

  it('keeps historical unequal base values rendered as a range', async () => {
    const text = await render(
      CustomerResidentialEmail({
        ...residential,
        baseRange: { lowIncGst: 27500, highIncGst: 31500 },
        callWindowText: 'within 30 minutes',
      }),
      { plainText: true },
    );

    expect(text).toContain('$27,500 - $31,500');
    expect(text).toContain('The range reflects the stored assumptions');
    expect(
      customerEstimatePreheader('residential', {
        lowIncGst: 27_500,
        highIncGst: 31_500,
      }),
    ).toBe(
      'Your project details, indicative installed range and the next steps from Sanctuary.',
    );
  });

  it('renders the professional hierarchy without promising a call window', async () => {
    const text = await render(
      CustomerProfessionalEmail({
        ...professional,
        callWindowText: 'within 30 minutes',
      }),
      { plainText: true },
    );

    expect(text.toLowerCase()).toContain('professional enquiry · received');
    expect(text.toLowerCase()).toContain(
      'thanks, alex morgan. we have your project brief.',
    );
    expect(text).toContain('We review the brief');
    expect(text).toContain('We agree the useful response');
    expect(text).toContain('Studio North Architects');
    expect(text).not.toContain('within 30 minutes');
    expect(PROFESSIONAL_ENQUIRY_PREHEADER).toContain('Your brief is with Sanctuary');
    expect(professionalEnquirySubject('Alex Morgan')).toBe(
      "Alex, we've received your project enquiry",
    );
  });

  it('shows expiring attachment links and handles missing optional fields', async () => {
    const withLinks = await render(
      CustomerResidentialEmail({
        ...residential,
        attachmentLinks: [
          {
            name: 'Concept-plan.pdf',
            url: 'https://files.example.test/signed-plan',
          },
        ],
        filesReceivedCount: 1,
        callWindowText: 'ignored',
      }),
      { plainText: true },
    );
    const missingOptional = await render(
      CustomerProfessionalEmail({
        ...professional,
        company: undefined,
        message: undefined,
        attachmentLinks: undefined,
        callWindowText: 'ignored',
      }),
      { plainText: true },
    );

    expect(withLinks).toContain('Files received with your enquiry');
    expect(withLinks).toContain('Concept-plan.pdf');
    expect(withLinks).toContain(
      'Secure download links expire seven days after the enquiry was submitted.',
    );
    expect(missingOptional).toContain('Practice or company');
    expect(missingOptional).toContain('Not supplied');
  });
});
