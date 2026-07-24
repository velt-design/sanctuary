import type { EnquiryPayload, Professional, ResidentialOrCommercial } from '../emails/types';
import {
  EMAIL_WEBSITE_AUTORESPONDER_COM_V1,
  EMAIL_WEBSITE_AUTORESPONDER_PRO_V1,
  EMAIL_WEBSITE_AUTORESPONDER_RES_V1,
  type WebsiteAutoresponderTemplateId,
} from './websiteAutoresponder';

export const WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS = [
  'residential',
  'residential-no-blinds',
  'commercial',
  'commercial-with-blinds',
  'professional',
] as const;

export type WebsiteAutoresponderPreviewVariant =
  (typeof WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS)[number];

type WebsiteAutoresponderPreviewFixture = Readonly<{
  variant: WebsiteAutoresponderPreviewVariant;
  label: string;
  fileBaseName: string;
  templateId: WebsiteAutoresponderTemplateId;
  variables: EnquiryPayload;
}>;

const submittedAt = new Date('2026-07-24T02:00:00.000Z');
const fixtureLink = 'https://www.sanctuarypergolas.co.nz/contact';

const baseLead = {
  leadId: 'email-preview-enquiry',
  submittedAt,
  name: 'Alex Morgan',
  email: 'alex.morgan@example.test',
  phone: '021 555 0199',
  suburb: 'Warkworth',
  message:
    'We would like a permanent outdoor room that keeps the afternoon light and works with the existing weatherboard home.',
  utmSource: 'fixture',
  utmMedium: 'email-preview',
  landingUrl: 'https://www.sanctuarypergolas.co.nz/contact',
} as const;

const residentialWithBlinds: ResidentialOrCommercial = {
  ...baseLead,
  enquiryType: 'residential',
  widthM: 4.8,
  depthM: 3.6,
  heightM: 2.7,
  style: 'Gable',
  roof: 'Acrylic',
  addons: ['Outdoor blinds', 'Integrated lighting'],
  blindsSelected: true,
  baseRange: { lowIncGst: 27_500, highIncGst: 27_500 },
  blindsRange: { lowIncGst: 7_500, highIncGst: 8_750 },
  filesReceivedCount: 2,
  attachmentLinks: [
    { name: 'Existing-site-photo.jpg', url: fixtureLink },
    { name: 'Concept-plan.pdf', url: fixtureLink },
  ],
};

const residentialWithoutBlinds: ResidentialOrCommercial = {
  ...residentialWithBlinds,
  addons: ['Integrated lighting', 'Heating'],
  blindsSelected: false,
  blindsRange: undefined,
  filesReceivedCount: 0,
  attachmentLinks: undefined,
};

const commercial: ResidentialOrCommercial = {
  ...baseLead,
  enquiryType: 'commercial',
  suburb: 'Grey Lynn',
  message:
    'The covered terrace needs to support day-to-day hospitality use while keeping clear movement along the shopfront.',
  widthM: 8.5,
  depthM: 4.2,
  heightM: 3.2,
  style: 'Hip',
  roof: 'Acrylic and timber-lined',
  addons: ['Integrated lighting', 'Fans'],
  blindsSelected: false,
  baseRange: { lowIncGst: 52_500, highIncGst: 52_500 },
  filesReceivedCount: 0,
};

const commercialWithBlinds: ResidentialOrCommercial = {
  ...commercial,
  addons: ['Outdoor blinds', 'Integrated lighting', 'Fans'],
  blindsSelected: true,
  blindsRange: { lowIncGst: 14_900, highIncGst: 17_250 },
  filesReceivedCount: 1,
  attachmentLinks: [{ name: 'Tenancy-plan.pdf', url: fixtureLink }],
};

const professional: Professional = {
  ...baseLead,
  enquiryType: 'professional',
  suburb: 'Mount Eden',
  company: 'Studio North Architects',
  message:
    'Developed design for a residential alteration. We are looking for early technical input on the roof interface and an indicative construction allowance.',
  filesReceivedCount: 2,
  attachmentLinks: [
    { name: 'Ground-floor-plan.pdf', url: fixtureLink },
    { name: 'North-elevation.pdf', url: fixtureLink },
  ],
};

const fixtures: Record<WebsiteAutoresponderPreviewVariant, WebsiteAutoresponderPreviewFixture> = {
  residential: {
    variant: 'residential',
    label: 'Residential',
    fileBaseName: 'customer-residential',
    templateId: EMAIL_WEBSITE_AUTORESPONDER_RES_V1,
    variables: residentialWithBlinds,
  },
  'residential-no-blinds': {
    variant: 'residential-no-blinds',
    label: 'Residential without blinds',
    fileBaseName: 'customer-residential-no-blinds',
    templateId: EMAIL_WEBSITE_AUTORESPONDER_RES_V1,
    variables: residentialWithoutBlinds,
  },
  commercial: {
    variant: 'commercial',
    label: 'Commercial',
    fileBaseName: 'customer-commercial',
    templateId: EMAIL_WEBSITE_AUTORESPONDER_COM_V1,
    variables: commercial,
  },
  'commercial-with-blinds': {
    variant: 'commercial-with-blinds',
    label: 'Commercial with blinds',
    fileBaseName: 'customer-commercial-with-blinds',
    templateId: EMAIL_WEBSITE_AUTORESPONDER_COM_V1,
    variables: commercialWithBlinds,
  },
  professional: {
    variant: 'professional',
    label: 'Professional',
    fileBaseName: 'customer-professional',
    templateId: EMAIL_WEBSITE_AUTORESPONDER_PRO_V1,
    variables: professional,
  },
};

export function isWebsiteAutoresponderPreviewVariant(
  value: unknown,
): value is WebsiteAutoresponderPreviewVariant {
  return (
    typeof value === 'string'
    && WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS.includes(
      value as WebsiteAutoresponderPreviewVariant,
    )
  );
}

export function getWebsiteAutoresponderPreviewFixture(
  variant: WebsiteAutoresponderPreviewVariant,
): WebsiteAutoresponderPreviewFixture {
  return fixtures[variant];
}
