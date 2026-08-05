import * as React from 'react';
import { AttachmentLinks } from '../components/AttachmentLinks';
import { EmailIntro } from '../components/EmailIntro';
import { EmailLayout } from '../components/EmailLayout';
import { HeroImage } from '../components/HeroImage';
import { InvestmentPanel, formatInvestmentAmount } from '../components/InvestmentPanel';
import { NextSteps, type EmailNextStep } from '../components/NextSteps';
import { ReplyInvitation } from '../components/ReplyInvitation';
import { Summary } from '../components/Summary';
import { customerEstimatePreheader } from '../customerAutoresponderCopy';
import { formatNZD } from '../utils/money';
import type { ResidentialOrCommercial } from '../types';
import { resolveWebsiteAutoresponderHero } from '../../lib/websiteAutoresponderHero';

type CustomerEstimateEmailProps = ResidentialOrCommercial & {
  callWindowText: string;
  enquiryType: 'residential' | 'commercial';
};

const residentialSteps: readonly EmailNextStep[] = [
  {
    title: 'We review the brief',
    description:
      'We check the dimensions, pergola form, roof approach and selected options against the notes you supplied.',
  },
  {
    title: 'We clarify the site',
    description:
      'We will get in touch if photographs, access, connections or measurements need more detail.',
  },
  {
    title: 'We shape the proposal',
    description:
      'Once the scope is understood, we will confirm the useful next step toward a measured proposal.',
  },
];

const commercialSteps: readonly EmailNextStep[] = [
  {
    title: 'We review the brief',
    description:
      'We check the intended use, dimensions, pergola form, roof approach and selected options.',
  },
  {
    title: 'We clarify the interfaces',
    description:
      'We will identify the site, access, structural and programme details needed to understand the work.',
  },
  {
    title: 'We define the next step',
    description:
      'Once the project context is clear, we will confirm what is needed for a measured proposal.',
  },
];

function supplied(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return 'Not supplied';
}

function dimensions(props: ResidentialOrCommercial): string {
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
  if (!values.every((value) => Number.isFinite(value) && value > 0)) return 'Not supplied';
  return `${props.widthM}m wide × ${props.depthM}m deep × ${props.heightM}m high`;
}

function simpleCoverLevel(value: NonNullable<ResidentialOrCommercial['simpleCoverEstimate']>['level']): string {
  return value === 'elevated' ? 'Elevated deck' : 'Ground-level deck';
}

function simpleCoverConnection(value: NonNullable<ResidentialOrCommercial['simpleCoverEstimate']>['connection']): string {
  if (value === 'facade') return 'Facade';
  if (value === 'soffit') return 'Soffit brackets';
  return 'Fascia';
}

export function CustomerEstimateEmail(props: CustomerEstimateEmailProps) {
  const isCommercial = props.enquiryType === 'commercial';
  const hero = resolveWebsiteAutoresponderHero(props);
  const baseIsSingleAmount = props.baseRange.lowIncGst === props.baseRange.highIncGst;
  const baseRange = formatInvestmentAmount(props.baseRange, formatNZD);
  const blindsRange =
    props.blindsSelected && props.blindsRange
      ? formatInvestmentAmount(props.blindsRange, formatNZD)
      : undefined;
  const options =
    Array.isArray(props.addons) && props.addons.length
      ? props.addons.filter((addon) => typeof addon === 'string' && addon.trim()).join(', ')
      : 'None selected';

  const estimateNote = props.simpleCoverEstimate
    ? `This is an early installed estimate, not a quote. It uses the selected dimensions, ${simpleCoverLevel(props.simpleCoverEstimate.level).toLowerCase()} and ${simpleCoverConnection(props.simpleCoverEstimate.connection).toLowerCase()}, together with the standard Simple calculator assumptions. Final scope and pricing follow Sanctuary's review of the site conditions and connection details.`
    : baseIsSingleAmount
    ? 'This is an early guide, not a quote. It is based on the dimensions and options submitted, with standard access, fixings, colour and fascia connection assumed. Final scope and pricing follow a review of the site conditions and connection details.'
    : 'This is an early guide, not a quote. The range reflects the stored assumptions available when this enquiry was submitted. Final scope and pricing follow a review of the site conditions and connection details.';

  return (
    <EmailLayout preview={customerEstimatePreheader(props.enquiryType, props.baseRange)}>
      <HeroImage hero={hero} />

      <EmailIntro
        eyebrow={`${isCommercial ? 'Commercial' : 'Residential'} enquiry · received`}
        heading={`Thanks, ${supplied(props.name)}. Your project starts here.`}
      >
        We&apos;ve received the outline for your {supplied(props.suburb)} project. This note keeps
        the details you shared, the early pricing guide and the next steps together.
      </EmailIntro>

      <InvestmentPanel
        baseRange={baseRange}
        blindsRange={blindsRange}
        note={estimateNote}
      />

      <NextSteps steps={isCommercial ? commercialSteps : residentialSteps} />

      <Summary
        title="Project details received"
        rows={[
          { label: isCommercial ? 'Project area' : 'Project location', value: supplied(props.suburb) },
          { label: 'Approximate dimensions', value: dimensions(props) },
          ...(props.simpleCoverEstimate
            ? [
                { label: 'Deck level', value: simpleCoverLevel(props.simpleCoverEstimate.level) },
                { label: 'House connection', value: simpleCoverConnection(props.simpleCoverEstimate.connection) },
              ]
            : []),
          { label: 'Pergola form', value: supplied(props.style) },
          { label: 'Roof approach', value: supplied(props.roof) },
          { label: 'Options to discuss', value: options },
          { label: 'Files received', value: String(props.filesReceivedCount ?? 0) },
          { label: 'Project brief', value: supplied(props.message) },
        ]}
      />

      <AttachmentLinks links={props.attachmentLinks} />

      <ReplyInvitation
        copy={
          isCommercial
            ? 'Reply directly with any drawings, site information, programme constraints or commercial requirements that would help us understand the project.'
            : 'Reply directly with any additional photos, plans, site constraints or timing preferences that would help us understand the space.'
        }
      />
    </EmailLayout>
  );
}
