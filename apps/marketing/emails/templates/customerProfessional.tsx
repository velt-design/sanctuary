import * as React from 'react';
import { AttachmentLinks } from '../components/AttachmentLinks';
import { EmailIntro } from '../components/EmailIntro';
import { EmailLayout } from '../components/EmailLayout';
import { HeroImage } from '../components/HeroImage';
import { NextSteps, type EmailNextStep } from '../components/NextSteps';
import { ReplyInvitation } from '../components/ReplyInvitation';
import { Summary } from '../components/Summary';
import { PROFESSIONAL_ENQUIRY_PREHEADER } from '../customerAutoresponderCopy';
import type { Professional } from '../types';

const professionalSteps: readonly EmailNextStep[] = [
  {
    title: 'We review the brief',
    description:
      'We read the project notes and drawings, then identify the decisions already made and the gaps still to resolve.',
  },
  {
    title: 'We clarify the interfaces',
    description:
      'We will confirm the project stage, structural connections, consent context and any site constraints that matter.',
  },
  {
    title: 'We agree the useful response',
    description:
      'The next step may be budget guidance, technical input, a site conversation or a measured proposal.',
  },
];

function supplied(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : 'Not supplied';
}

export function CustomerProfessionalEmail(props: Professional & { callWindowText: string }) {
  return (
    <EmailLayout preview={PROFESSIONAL_ENQUIRY_PREHEADER}>
      <HeroImage />

      <EmailIntro
        eyebrow="Professional enquiry · received"
        heading={`Thanks, ${supplied(props.name)}. We have your project brief.`}
      >
        We&apos;ve received the outline for your {supplied(props.suburb)} project. The details and
        files below give us a clear starting point for a useful project conversation.
      </EmailIntro>

      <NextSteps steps={professionalSteps} />

      <Summary
        title="Project details received"
        rows={[
          { label: 'Practice or company', value: supplied(props.company) },
          { label: 'Project location', value: supplied(props.suburb) },
          { label: 'Contact phone', value: supplied(props.phone) },
          { label: 'Files received', value: String(props.filesReceivedCount ?? 0) },
          { label: 'Project brief', value: supplied(props.message) },
        ]}
      />

      <AttachmentLinks links={props.attachmentLinks} />

      <ReplyInvitation copy="Reply directly with any additional drawings, project-stage context, boundary conditions, wind exposure or interface details that would help us understand the work." />
    </EmailLayout>
  );
}
