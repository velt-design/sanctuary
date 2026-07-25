import type { WebsiteAutoresponderHero } from '../../lib/websiteAutoresponderHero';
import { resolveWebsiteAutoresponderHero } from '../../lib/websiteAutoresponderHero';
import {
  EMAIL_WEBSITE_AUTORESPONDER_PRO_V1,
  type WebsiteAutoresponderTemplateId,
} from '../../lib/websiteAutoresponderContract';
import type { Professional, ResidentialOrCommercial } from '../types';
import { formatInvestmentAmount } from '../components/InvestmentPanel';
import { formatNZD } from '../utils/money';

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

function dimensions(props: ResidentialOrCommercial): string {
  const values = [props.widthM, props.depthM, props.heightM];
  if (!values.every((value) => Number.isFinite(value) && value > 0)) {
    return 'Not supplied';
  }
  return `${props.widthM}m wide × ${props.depthM}m deep × ${props.heightM}m high`;
}

function estimateModel(
  props: ResidentialOrCommercial,
): Pick<
  AlternativeEmailModel,
  'baseInvestment' | 'blindsInvestment' | 'estimateNote'
> {
  const baseIsSingleAmount =
    props.baseRange.lowIncGst === props.baseRange.highIncGst;
  return {
    baseInvestment: formatInvestmentAmount(props.baseRange, formatNZD),
    blindsInvestment:
      props.blindsSelected && props.blindsRange
        ? formatInvestmentAmount(props.blindsRange, formatNZD)
        : undefined,
    estimateNote: baseIsSingleAmount
      ? 'An early installed estimate, including GST. It is not a quote and assumes standard access, fixings, colour and fascia connection. We will confirm the final scope after reviewing the site and connection details.'
      : 'An early installed range, including GST. It reflects the assumptions stored with this enquiry and is not a quote. We will confirm the final scope after reviewing the site and connection details.',
  };
}

function estimateSteps(
  audience: 'residential' | 'commercial',
): readonly AlternativeEmailStep[] {
  if (audience === 'commercial') {
    return [
      {
        title: 'A designer reviews your brief',
        description:
          'We check the intended use, dimensions, roof form, selected options and information supplied.',
      },
      {
        title: 'We confirm the project interfaces',
        description:
          'We identify the site, access, structural and programme details needed to understand the work.',
      },
      {
        title: 'We recommend the next step',
        description:
          'Once the context is clear, we confirm what is needed for a measured proposal.',
      },
    ];
  }

  return [
    {
      title: 'A designer reviews your brief',
      description:
        'We check the dimensions, roof form, roof approach and options against the notes supplied.',
    },
    {
      title: 'We confirm the site questions',
      description:
        'We get in touch if photographs, access, connections or measurements need more detail.',
    },
    {
      title: 'We recommend the next step',
      description:
        'Once the scope is understood, we confirm the useful path toward a measured proposal.',
    },
  ];
}

function buildEstimateModel(
  templateId: WebsiteAutoresponderTemplateId,
  variables: Record<string, unknown>,
): AlternativeEmailModel {
  const props = variables as unknown as ResidentialOrCommercial;
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
    eyebrow: `${isCommercial ? 'Commercial' : 'Residential'} pergola enquiry · received`,
    heading: `Thanks, ${firstName(props.name)}. Your pergola brief is with us.`,
    intro: `We have the details for your ${supplied(props.suburb)} project, including the roof form, selected options and early installed estimate.`,
    reassurance:
      'You do not need to submit the form again. The information below is the brief our team will review.',
    hero: resolveWebsiteAutoresponderHero(props),
    ...estimateModel(props),
    steps: estimateSteps(audience),
    summary: [
      {
        label: isCommercial ? 'Project area' : 'Project location',
        value: supplied(props.suburb),
      },
      { label: 'Approximate dimensions', value: dimensions(props) },
      { label: 'Pergola form', value: supplied(props.style) },
      { label: 'Roof approach', value: supplied(props.roof) },
      { label: 'Options to discuss', value: options },
      {
        label: 'Files received',
        value: String(props.filesReceivedCount ?? 0),
      },
      { label: 'Your project note', value: supplied(props.message) },
    ],
    attachmentLinks: props.attachmentLinks ?? [],
    replyPrompt: isCommercial
      ? 'Reply with any drawings, site information, programme constraints or commercial requirements that would help us understand the project.'
      : 'Reply with any additional photos, plans, site constraints or timing preferences that would help us understand the space.',
    replyButtonLabel: 'Add project information',
  };
}

function buildProfessionalModel(
  variables: Record<string, unknown>,
): AlternativeEmailModel {
  const props = variables as unknown as Professional;
  return {
    audience: 'professional',
    eyebrow: 'Professional project enquiry · received',
    heading: `Thanks, ${firstName(props.name)}. Your project brief is with us.`,
    intro: `We have received the outline and files for your ${supplied(props.suburb)} project. They give our team a clear starting point for a useful technical conversation.`,
    reassurance:
      'You do not need to submit the form again. The information below is the brief our team will review.',
    hero: resolveWebsiteAutoresponderHero(props),
    steps: [
      {
        title: 'We review the design brief',
        description:
          'We read the notes and drawings, then identify decisions already made and gaps still to resolve.',
      },
      {
        title: 'We clarify the interfaces',
        description:
          'We confirm the project stage, structural connections, consent context and relevant site constraints.',
      },
      {
        title: 'We agree the useful response',
        description:
          'The next step may be budget guidance, technical input, a site conversation or a measured proposal.',
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
      'Reply with any additional drawings, project-stage context, boundary conditions, wind exposure or interface details that would help us understand the work.',
    replyButtonLabel: 'Add project information',
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
