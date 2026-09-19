import type { WebsiteAutoresponderHero } from '../../lib/websiteAutoresponderHero';
import { resolveWebsiteAutoresponderHero } from '../../lib/websiteAutoresponderHero';
import {
  EMAIL_WEBSITE_AUTORESPONDER_PRO_V1,
  type WebsiteAutoresponderTemplateId,
} from '../../lib/websiteAutoresponderContract';
import type {
  Professional,
  ResidentialOrCommercialEnquiry,
} from '../types';
import { formatInvestmentAmount } from '../components/InvestmentPanel';
import { formatNZD } from '../utils/money';
import { submittedEmailDesign } from '../SubmittedDesign';

export type AlternativeEmailStep = Readonly<{
  title: string;
  description: string;
}>;

export type AlternativeEmailRow = Readonly<{
  label: string;
  value: string;
}>;

export type AlternativeEmailModel = Readonly<{
  audience: 'residential' | 'commercial' | 'professional';
  eyebrow: string;
  heading: string;
  intro: string;
  reassurance: string;
  hero: WebsiteAutoresponderHero;
  baseInvestment?: string;
  blindsInvestment?: string;
  estimateNote?: string;
  summary: readonly AlternativeEmailRow[];
  steps: readonly AlternativeEmailStep[];
  attachmentLinks: readonly { name: string; url: string }[];
  replyPrompt: string;
  replyButtonLabel: string;
  submittedDesign?: ReturnType<typeof submittedEmailDesign>;
  configuredEstimate?: unknown;
  filesReceivedCount?: number;
}>;

function supplied(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return 'Not supplied';
}

function firstName(value: unknown): string {
  const name = supplied(value);
  return name === 'Not supplied' ? 'there' : (name.split(/\s+/)[0] ?? 'there');
}

function dimensions(props: ResidentialOrCommercialEnquiry): string {
  if (
    props.simpleCoverEstimate
    && Number.isFinite(props.widthM)
    && props.widthM > 0
    && Number.isFinite(props.depthM)
    && props.depthM > 0
  ) {
    return `${props.widthM}m wide × ${props.depthM}m deep`;
  }
  const values = [props.widthM, props.depthM, props.heightM];
  if (!values.every((value) => Number.isFinite(value) && value > 0)) {
    return 'Not supplied';
  }
  return `${props.widthM}m wide × ${props.depthM}m deep × ${props.heightM}m high`;
}

function simpleCoverLevel(value: NonNullable<ResidentialOrCommercialEnquiry['simpleCoverEstimate']>['level']): string {
  return value === 'elevated' ? 'Elevated deck' : 'Ground-level deck';
}

function simpleCoverConnection(value: NonNullable<ResidentialOrCommercialEnquiry['simpleCoverEstimate']>['connection']): string {
  if (value === 'facade') return 'Facade';
  if (value === 'soffit') return 'Soffit brackets';
  return 'Fascia';
}

function estimateModel(
  props: ResidentialOrCommercialEnquiry,
): Pick<
  AlternativeEmailModel,
  'baseInvestment' | 'blindsInvestment' | 'estimateNote'
> {
  if (!props.baseRange) {
    return {};
  }
  const baseIsSingleAmount =
    props.baseRange.lowIncGst === props.baseRange.highIncGst;
  return {
    baseInvestment: formatInvestmentAmount(props.baseRange, formatNZD),
    blindsInvestment:
      props.blindsSelected && props.blindsRange
        ? formatInvestmentAmount(props.blindsRange, formatNZD)
        : undefined,
    estimateNote: props.simpleCoverEstimate
      ? `Not a quote. Uses your selected dimensions, ${simpleCoverLevel(props.simpleCoverEstimate.level).toLowerCase()} and ${simpleCoverConnection(props.simpleCoverEstimate.connection).toLowerCase()}, with standard Simple calculator assumptions. Subject to site confirmation.`
      : baseIsSingleAmount
      ? 'Not a quote. Assumes standard access, fixings, colour and a fascia connection. Subject to site confirmation.'
      : 'Not a quote. This range uses the assumptions saved with your enquiry. Subject to site confirmation.',
  };
}

function estimateSteps(
  audience: 'residential' | 'commercial',
): readonly AlternativeEmailStep[] {
  if (audience === 'commercial') {
    return [
      {
        title: 'We review your project',
        description:
          'We check the intended use, dimensions, roof form, selected options and information supplied.',
      },
      {
        title: 'We discuss your site and timing',
        description:
          'We’ll ask about access, structural connections and when the work needs to be done.',
      },
      {
        title: 'We explain what is needed for a quote',
        description:
          'We’ll confirm the measurements and design details needed to prepare your proposal.',
      },
    ];
  }

  return [
    {
      title: 'A designer reviews your brief',
      description:
        'We’ll check your size, roof and selected options alongside your notes.',
    },
    {
      title: 'We discuss your site',
      description:
        'We’ll ask for any photos or measurements we need and discuss how the pergola will connect to your home.',
    },
    {
      title: 'We explain what is needed for a quote',
      description:
        'We’ll explain whether a site measure or more design work is needed before we prepare your proposal.',
    },
  ];
}

function buildEstimateModel(
  templateId: WebsiteAutoresponderTemplateId,
  variables: Record<string, unknown>,
): AlternativeEmailModel {
  const props = variables as unknown as ResidentialOrCommercialEnquiry;
  const audience =
    templateId === EMAIL_WEBSITE_AUTORESPONDER_PRO_V1
      ? 'professional'
      : props.enquiryType === 'commercial'
        ? 'commercial'
        : 'residential';
  if (audience === 'professional') {
    throw new Error('Professional enquiries require the professional model.');
  }
  const options =
    Array.isArray(props.addons) && props.addons.length
      ? props.addons
          .filter(
            (addon): addon is string =>
              typeof addon === 'string' && Boolean(addon.trim()),
          )
          .join(', ')
      : 'None selected';
  const isCommercial = audience === 'commercial';

  return {
    audience,
    submittedDesign: submittedEmailDesign(variables),
    configuredEstimate: props.configuredEstimate,
    filesReceivedCount: props.filesReceivedCount,
    eyebrow: `${isCommercial ? 'Commercial' : 'Residential'} pergola enquiry · received`,
    heading: `Thanks, ${firstName(props.name)}. We’ve received your pergola enquiry.`,
    intro: props.suburb ? `Thanks for getting in touch about your project in ${supplied(props.suburb)}.` : 'Thanks for getting in touch about your pergola.',
    reassurance:
      'Our team will review your enquiry and reply by email. You don’t need to do anything else for now.',
    hero: resolveWebsiteAutoresponderHero(props),
    ...estimateModel(props),
    steps: estimateSteps(audience),
    summary: [
      {
        label: isCommercial ? 'Project area' : 'Project location',
        value: supplied(props.suburb),
      },
      { label: 'Approximate dimensions', value: dimensions(props) },
      ...(props.simpleCoverEstimate
        ? [
            { label: 'Deck level', value: simpleCoverLevel(props.simpleCoverEstimate.level) },
            { label: 'House connection', value: simpleCoverConnection(props.simpleCoverEstimate.connection) },
          ]
        : []),
      { label: 'Pergola shape', value: supplied(props.style) },
      { label: 'Roof material', value: props.roof === 'Both' ? 'Acrylic and timber' : supplied(props.roof) },
      { label: 'Options to discuss', value: options },
      {
        label: 'Files received',
        value: String(props.filesReceivedCount ?? 0),
      },
      { label: 'Your project note', value: supplied(props.message) },
    ],
    attachmentLinks: props.attachmentLinks ?? [],
    replyPrompt: isCommercial
      ? 'Reply to this email with plans, site information, timing requirements or questions.'
      : 'Reply to this email with photos, plans or questions. Tell us if you’d like to change any of the details you submitted.',
    replyButtonLabel: 'Email Sanctuary',
  };
}

function buildProfessionalModel(
  variables: Record<string, unknown>,
): AlternativeEmailModel {
  const props = variables as unknown as Professional;
  return {
    audience: 'professional',
    submittedDesign: submittedEmailDesign(variables),
    filesReceivedCount: props.filesReceivedCount,
    eyebrow: 'Professional project enquiry · received',
    heading: `Thanks, ${firstName(props.name)}. We’ve received your project enquiry.`,
    intro: 'Thanks for involving Sanctuary. We’ve received your enquiry and will review the project information you supplied.',
    reassurance:
      'Our team will review your enquiry and reply by email. You don’t need to do anything else for now.',
    hero: resolveWebsiteAutoresponderHero(props),
    steps: [
      {
        title: 'We review your project information',
        description:
          'We read the notes and drawings, then identify decisions already made and gaps still to resolve.',
      },
      {
        title: 'We discuss the technical details',
        description:
          'We’ll discuss the project stage, structural connections, consent requirements and site constraints.',
      },
      {
        title: 'We agree what you need from us',
        description:
          'We’ll confirm whether you need budget guidance, design details, a site discussion or a proposal.',
      },
    ],
    summary: [
      { label: 'Practice or company', value: supplied(props.company) },
      { label: 'Project location', value: supplied(props.suburb) },
      { label: 'Contact phone', value: supplied(props.phone) },
      {
        label: 'Files received',
        value: String(props.filesReceivedCount ?? 0),
      },
      { label: 'Your project note', value: supplied(props.message) },
    ],
    attachmentLinks: props.attachmentLinks ?? [],
    replyPrompt:
      'Reply to this email with drawings, site details or questions you’d like us to consider.',
    replyButtonLabel: 'Email Sanctuary',
  };
}

export function buildAlternativeEmailModel(
  templateId: WebsiteAutoresponderTemplateId,
  variables: Record<string, unknown>,
): AlternativeEmailModel {
  return templateId === EMAIL_WEBSITE_AUTORESPONDER_PRO_V1
    ? buildProfessionalModel(variables)
    : buildEstimateModel(templateId, variables);
}
