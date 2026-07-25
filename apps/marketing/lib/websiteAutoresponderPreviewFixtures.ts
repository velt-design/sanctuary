import type { EnquiryPayload, Professional, ResidentialOrCommercial } from '../emails/types';
import {
  EMAIL_WEBSITE_AUTORESPONDER_COM_V1,
  EMAIL_WEBSITE_AUTORESPONDER_PRO_V1,
  EMAIL_WEBSITE_AUTORESPONDER_RES_V1,
  type WebsiteAutoresponderTemplateId,
} from './websiteAutoresponder';

export const WEBSITE_AUTORESPONDER_PREVIEW_CUSTOMER_TYPES = [
  'residential',
  'commercial',
] as const;
export const WEBSITE_AUTORESPONDER_PREVIEW_ROOF_FORMS = [
  'pitched',
  'gable',
  'box-perimeter',
  'hip',
] as const;
export const WEBSITE_AUTORESPONDER_PREVIEW_BLINDS_OPTIONS = [
  'without-blinds',
  'with-blinds',
] as const;

export type WebsiteAutoresponderPreviewCustomerType =
  (typeof WEBSITE_AUTORESPONDER_PREVIEW_CUSTOMER_TYPES)[number];
export type WebsiteAutoresponderPreviewRoofForm =
  (typeof WEBSITE_AUTORESPONDER_PREVIEW_ROOF_FORMS)[number];
export type WebsiteAutoresponderPreviewBlindsOption =
  (typeof WEBSITE_AUTORESPONDER_PREVIEW_BLINDS_OPTIONS)[number];
export type WebsiteAutoresponderPreviewVariant =
  | `${WebsiteAutoresponderPreviewCustomerType}-${WebsiteAutoresponderPreviewRoofForm}-${WebsiteAutoresponderPreviewBlindsOption}`
  | 'professional';

export type WebsiteAutoresponderPreviewSelection =
  | Readonly<{
      customerType: WebsiteAutoresponderPreviewCustomerType;
      roofForm: WebsiteAutoresponderPreviewRoofForm;
      blinds: WebsiteAutoresponderPreviewBlindsOption;
    }>
  | Readonly<{
      customerType: 'professional';
    }>;

export type WebsiteAutoresponderPreviewFixture = Readonly<{
  variant: WebsiteAutoresponderPreviewVariant;
  label: string;
  fileBaseName: string;
  templateId: WebsiteAutoresponderTemplateId;
  variables: EnquiryPayload;
  selection: WebsiteAutoresponderPreviewSelection;
}>;

const submittedAt = new Date('2026-07-24T02:00:00.000Z');
const fixtureLink = 'https://www.sanctuarypergolas.co.nz/contact';

const baseLead = {
  submittedAt,
  name: 'Alex Morgan',
  email: 'alex.morgan@example.test',
  phone: '021 555 0199',
  utmSource: 'fixture',
  utmMedium: 'email-preview',
  landingUrl: 'https://www.sanctuarypergolas.co.nz/contact',
} as const;

type RoofFixtureContext = Readonly<{
  style: ResidentialOrCommercial['style'];
  roof: ResidentialOrCommercial['roof'];
  residential: Readonly<{
    suburb: string;
    message: string;
    widthM: number;
    depthM: number;
    heightM: number;
    baseAmount: number;
  }>;
  commercial: Readonly<{
    suburb: string;
    message: string;
    widthM: number;
    depthM: number;
    heightM: number;
    baseAmount: number;
  }>;
}>;

const roofContexts: Record<WebsiteAutoresponderPreviewRoofForm, RoofFixtureContext> = {
  pitched: {
    style: 'Pitched',
    roof: 'Both',
    residential: {
      suburb: 'Tindalls Bay',
      message:
        'We want a single-pitch outdoor dining roof with a warmer lined zone while keeping daylight near the house.',
      widthM: 5.4,
      depthM: 3.8,
      heightM: 2.8,
      baseAmount: 24_500,
    },
    commercial: {
      suburb: 'Tamaki Drive',
      message:
        'The pitched covered terrace needs to support day-to-day hospitality use while keeping clear movement along the shopfront.',
      widthM: 8.5,
      depthM: 4.2,
      heightM: 3.2,
      baseAmount: 52_500,
    },
  },
  gable: {
    style: 'Gable',
    roof: 'Both',
    residential: {
      suburb: 'Warkworth',
      message:
        'We would like a gable outdoor room that keeps the afternoon light and works with the existing weatherboard home.',
      widthM: 4.8,
      depthM: 3.6,
      heightM: 2.7,
      baseAmount: 27_500,
    },
    commercial: {
      suburb: 'Takanini',
      message:
        'We need a gable roof over a hospitality courtyard, with integrated lighting and weather protection at the exposed edges.',
      widthM: 9.2,
      depthM: 5.1,
      heightM: 3.6,
      baseAmount: 58_500,
    },
  },
  'box-perimeter': {
    style: 'Perimeter',
    roof: 'Acrylic',
    residential: {
      suburb: 'Mount Maunganui',
      message:
        'We want a clean box-perimeter roof over the deck, with the roof fall and drainage concealed from view.',
      widthM: 6.8,
      depthM: 3.4,
      heightM: 2.8,
      baseAmount: 29_500,
    },
    commercial: {
      suburb: 'Waiheke',
      message:
        'The commercial terrace needs a restrained box-perimeter form with concealed drainage and clear circulation around the tenancy.',
      widthM: 9.6,
      depthM: 4.4,
      heightM: 3.1,
      baseAmount: 61_500,
    },
  },
  hip: {
    style: 'Hip',
    roof: 'Acrylic',
    residential: {
      suburb: 'Muriwai',
      message:
        'We would like a hipped courtyard roof that feels integrated with the home and keeps soft daylight in the rooms beside it.',
      widthM: 8,
      depthM: 5,
      heightM: 3,
      baseAmount: 31_500,
    },
    commercial: {
      suburb: 'Waitakere',
      message:
        'The courtyard brief calls for a hipped roof form that gives the covered area a composed edge on every side.',
      widthM: 9,
      depthM: 6,
      heightM: 3.4,
      baseAmount: 64_500,
    },
  },
};

function variantForSelection(
  customerType: WebsiteAutoresponderPreviewCustomerType,
  roofForm: WebsiteAutoresponderPreviewRoofForm,
  blinds: WebsiteAutoresponderPreviewBlindsOption,
): WebsiteAutoresponderPreviewVariant {
  return `${customerType}-${roofForm}-${blinds}`;
}

function configurableSelections(): WebsiteAutoresponderPreviewSelection[] {
  return WEBSITE_AUTORESPONDER_PREVIEW_CUSTOMER_TYPES.flatMap((customerType) =>
    WEBSITE_AUTORESPONDER_PREVIEW_BLINDS_OPTIONS.flatMap((blinds) =>
      WEBSITE_AUTORESPONDER_PREVIEW_ROOF_FORMS.map((roofForm) => ({
        customerType,
        roofForm,
        blinds,
      })),
    ),
  );
}

const professionalSelection = Object.freeze({
  customerType: 'professional' as const,
});

const previewSelections = Object.freeze([
  ...configurableSelections(),
  professionalSelection,
]);

export const WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS = Object.freeze(
  previewSelections.map((selection) =>
    selection.customerType === 'professional'
      ? 'professional'
      : variantForSelection(selection.customerType, selection.roofForm, selection.blinds),
  ),
) as readonly WebsiteAutoresponderPreviewVariant[];

const variantSet = new Set<string>(WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS);

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function buildResidentialOrCommercialFixture(
  selection: Exclude<WebsiteAutoresponderPreviewSelection, { customerType: 'professional' }>,
): WebsiteAutoresponderPreviewFixture {
  const { customerType, roofForm, blinds } = selection;
  const hasBlinds = blinds === 'with-blinds';
  const context = roofContexts[roofForm];
  const audienceContext = context[customerType];
  const variant = variantForSelection(customerType, roofForm, blinds);
  const isCommercial = customerType === 'commercial';
  const variables: ResidentialOrCommercial = {
    ...baseLead,
    leadId: `email-preview-${variant}`,
    enquiryType: customerType,
    suburb: audienceContext.suburb,
    message: audienceContext.message,
    widthM: audienceContext.widthM,
    depthM: audienceContext.depthM,
    heightM: audienceContext.heightM,
    style: context.style,
    roof:
      isCommercial && (roofForm === 'pitched' || roofForm === 'gable')
        ? 'Acrylic'
        : context.roof,
    addons: hasBlinds
      ? ['Outdoor blinds', 'Integrated lighting', ...(isCommercial ? ['Fans'] : ['Heating'])]
      : ['Integrated lighting', ...(isCommercial ? ['Fans'] : ['Heating'])],
    blindsSelected: hasBlinds,
    baseRange: {
      lowIncGst: audienceContext.baseAmount,
      highIncGst: audienceContext.baseAmount,
    },
    blindsRange: hasBlinds
      ? isCommercial
        ? { lowIncGst: 14_900, highIncGst: 17_250 }
        : { lowIncGst: 7_500, highIncGst: 8_750 }
      : undefined,
    filesReceivedCount: roofForm === 'gable' && hasBlinds ? (isCommercial ? 1 : 2) : 0,
    attachmentLinks:
      roofForm === 'gable' && hasBlinds
        ? isCommercial
          ? [{ name: 'Tenancy-plan.pdf', url: fixtureLink }]
          : [
              { name: 'Existing-site-photo.jpg', url: fixtureLink },
              { name: 'Concept-plan.pdf', url: fixtureLink },
            ]
        : undefined,
  };

  return Object.freeze({
    variant,
    label: `${titleCase(customerType)} · ${titleCase(roofForm)} · ${hasBlinds ? 'With blinds' : 'Without blinds'}`,
    fileBaseName: `customer-${variant}`,
    templateId: isCommercial
      ? EMAIL_WEBSITE_AUTORESPONDER_COM_V1
      : EMAIL_WEBSITE_AUTORESPONDER_RES_V1,
    variables,
    selection,
  });
}

function buildProfessionalFixture(): WebsiteAutoresponderPreviewFixture {
  const variables: Professional = {
    ...baseLead,
    leadId: 'email-preview-professional',
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

  return Object.freeze({
    variant: 'professional',
    label: 'Professional',
    fileBaseName: 'customer-professional',
    templateId: EMAIL_WEBSITE_AUTORESPONDER_PRO_V1,
    variables,
    selection: professionalSelection,
  });
}

const fixtures = new Map<WebsiteAutoresponderPreviewVariant, WebsiteAutoresponderPreviewFixture>(
  previewSelections.map((selection) => {
    const fixture =
      selection.customerType === 'professional'
        ? buildProfessionalFixture()
        : buildResidentialOrCommercialFixture(selection);
    return [fixture.variant, fixture];
  }),
);

export function isWebsiteAutoresponderPreviewVariant(
  value: unknown,
): value is WebsiteAutoresponderPreviewVariant {
  return typeof value === 'string' && variantSet.has(value);
}

export function getWebsiteAutoresponderPreviewFixture(
  variant: WebsiteAutoresponderPreviewVariant,
): WebsiteAutoresponderPreviewFixture {
  const fixture = fixtures.get(variant);
  if (!fixture) {
    throw new Error(`Missing website autoresponder preview fixture: ${variant}`);
  }
  return fixture;
}
