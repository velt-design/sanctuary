import * as React from 'react';
import { Button, Heading, Section, Text } from '@react-email/components';
import { AlternativeEmailShell, type AlternativePreviewTheme } from './alternatives/AlternativeEmailShell';
import { AttachmentList, DetailRows, Eyebrow, InvestmentBlock, EstimateNote, ReplyPanel, StepRows } from './alternatives/AlternativeEmailParts';
import { buildAlternativeEmailModel } from './alternatives/alternativeEmailModel';
import { websiteAutoresponderTemplateIdFor } from '../lib/websiteAutoresponderContract';
import { ENQUIRY_EXPERIENCES, ENQUIRY_NEXT_STEPS, type EnquiryExperience } from '../lib/enquiryExperience';
import type { CustomerBrief } from '../lib/enquiryDesignContract';
import { customerDesignUrl } from '../lib/enquiryDesignLink';
import { THEME } from './theme';

export function EnquiryExperienceEmail({ experience, variables, previewTheme }: {
  experience: EnquiryExperience; variables: Record<string, unknown>; previewTheme?: AlternativePreviewTheme;
}) {
  const copy = ENQUIRY_EXPERIENCES[experience];
  const audience = experience === 'configured' || experience === 'bespoke' ? 'residential' : experience;
  const model = buildAlternativeEmailModel(websiteAutoresponderTemplateIdFor(audience), variables);
  const brief = variables.customerBrief as CustomerBrief | undefined;
  const designUrl = brief?.design ? (typeof variables.submittedDesignUrl === 'string' && /^https:\/\/(www\.sanctuarypergolas\.co\.nz|[a-z0-9.-]+\.vercel\.app)\/configurator-preview\?open=1#design=/.test(variables.submittedDesignUrl) ? variables.submittedDesignUrl : customerDesignUrl(brief)) : undefined;
  const rows = model.summary.filter(row => {
    if (row.label === 'Your project note') return false;
    if (audience !== 'residential') return /phone|files/i.test(row.label);
    if (designUrl) return /location|phone|files/i.test(row.label);
    return row.value !== 'Not supplied';
  });
  const steps = ENQUIRY_NEXT_STEPS[experience];
  return <AlternativeEmailShell preview={copy.preheader} previewTheme={previewTheme}>
    <Section className="spx-surface spx-mobile-pad" style={{ background: THEME.elevated, padding: '32px', color: THEME.text }}>
      <Eyebrow>{copy.label}</Eyebrow>
      <Heading as="h1" className="spx-text" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing: '-1px' }}>{copy.subject}</Heading>
      <Text className="spx-muted" style={{ lineHeight: 1.7 }}>{copy.intro}</Text>
      {(audience === 'commercial' || audience === 'professional') && <Section style={{ margin: '24px 0' }}>
        <Eyebrow>{audience === 'professional' ? 'Practice & project' : 'Business & project'}</Eyebrow>
        <DetailRows rows={[{ label: 'Organisation', value: String(variables.company || 'Not supplied') }, { label: 'Location', value: String(variables.suburb || 'Not supplied') }, ...(variables.projectRole ? [{ label: 'Your role', value: String(variables.projectRole) }] : []), ...(variables.projectStage ? [{ label: 'Project stage', value: String(variables.projectStage) }] : [])]} />
      </Section>}
      {designUrl && <Section className="spx-rule" style={{ border: `1px solid ${THEME.rule}`, padding: 20, margin: '24px 0' }}>
        <Eyebrow>Your submitted design</Eyebrow>
        <Text className="spx-text" style={{ lineHeight: 1.7 }}>{brief?.summary}</Text>
        <Button href={designUrl} style={{ background: '#4e5747', color: '#ffffff', padding: '14px 20px' }}>View your submitted pergola</Button>
        <Text className="spx-muted" style={{ fontSize: 12 }}>This opens the design you submitted. Later changes won’t update this enquiry. Reply to us if you’d like to revise it.</Text>
      </Section>}
      <Section style={{ margin: '24px 0' }}><Eyebrow>{experience === 'bespoke' ? 'What you have in mind' : 'Your note'}</Eyebrow><Text className="spx-text" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{String(variables.message || 'No additional note supplied.')}</Text></Section>
      <InvestmentBlock model={model} /><EstimateNote model={model} />
      <Section style={{ margin: '28px 0' }}><Eyebrow>What happens next</Eyebrow><StepRows steps={steps} /></Section>
      <Section style={{ margin: '24px 0' }}><Eyebrow>Enquiry details</Eyebrow><DetailRows rows={rows} /></Section>
      <AttachmentList links={model.attachmentLinks} /><ReplyPanel model={model} />
    </Section>
  </AlternativeEmailShell>;
}
