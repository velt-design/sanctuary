import * as React from 'react';
import { Heading, Section, Text } from '@react-email/components';
import { ConfiguredEstimate } from './ConfiguredEstimate';
import { AlternativeEmailShell, type AlternativePreviewTheme } from './alternatives/AlternativeEmailShell';
import { AttachmentList, InvestmentBlock, EstimateNote } from './alternatives/AlternativeEmailParts';
import { buildAlternativeEmailModel } from './alternatives/alternativeEmailModel';
import { websiteAutoresponderTemplateIdFor } from '../lib/websiteAutoresponderContract';
import { ENQUIRY_EXPERIENCES, type EnquiryExperience } from '../lib/enquiryExperience';
import { SubmittedDesign, ReceiptClosing } from './SubmittedDesign';
import { THEME } from './theme';

const nextAction: Record<EnquiryExperience, string> = {
  configured: 'We’ll review your design and reply by email to arrange a site measure.',
  help: 'We’ll reply by email to help you choose a pergola for your space.',
  bespoke: 'We’ll review your ideas and reply by email to discuss your design.',
  commercial: 'We’ll reply by email to discuss your project, timing and site requirements.',
  professional: 'We’ll review your project information and reply by email to discuss what you need from us.',
};

export function EnquiryExperienceEmail({ experience, variables, previewTheme }: {
  experience: EnquiryExperience; variables: Record<string, unknown>; previewTheme?: AlternativePreviewTheme;
}) {
  const copy = ENQUIRY_EXPERIENCES[experience];
  const audience = experience === 'configured' || experience === 'bespoke' || experience === 'help' ? 'residential' : experience;
  const model = buildAlternativeEmailModel(websiteAutoresponderTemplateIdFor(audience), variables);
  const firstName = typeof variables.name === 'string' ? variables.name.trim().split(/\s+/)[0] : '';
  return <AlternativeEmailShell preview={copy.preheader} previewTheme={previewTheme}>
    <Section className="spx-surface spx-rule spx-mobile-pad" style={{ backgroundColor: THEME.elevated, padding: '34px', color: THEME.text, borderLeft: '1px solid ' + THEME.rule, borderRight: '1px solid ' + THEME.rule }}>
      <Heading as="h1" className="spx-heading spx-text" style={{ margin: '0 0 24px', color: THEME.text, fontSize: 30, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-1px' }}>{experience === 'configured' ? 'We’ve received your design' : 'We’ve received your enquiry'}</Heading>
      <Text className="spx-text" style={{ color: THEME.text, fontSize: 16, lineHeight: 1.65, margin: '0 0 12px' }}>{firstName ? 'Thanks, ' + firstName + '.' : 'Thanks for getting in touch.'} {nextAction[experience]} We typically respond within one working day.</Text>
      {experience === 'configured'
        ? <Text className="spx-muted" style={{ color: THEME.muted, fontSize: 14, lineHeight: 1.65, margin: '0 0 20px' }}>A visit is not booked yet. We offer a free site measure and evaluation in Auckland. Outside Auckland, we’ll confirm availability and any travel cost first.</Text>
        : <Text className="spx-muted" style={{ color: THEME.muted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>You don’t need to do anything else for now.</Text>}
      {experience === 'configured' ? <ConfiguredEstimate value={variables.configuredEstimate} /> : <><InvestmentBlock model={model} tone="warm" /><EstimateNote model={model} /></>}
      <SubmittedDesign design={model.submittedDesign} />
      <AttachmentList links={model.attachmentLinks} compact />
      <ReceiptClosing filesReceivedCount={model.filesReceivedCount} hasDownloadLinks={model.attachmentLinks.length > 0} />
    </Section>
  </AlternativeEmailShell>;
}
