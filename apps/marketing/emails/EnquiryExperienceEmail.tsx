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
import { normalizeEnquiryProjectPreferences } from '../lib/enquiryProjectPreferences';

export function EnquiryExperienceEmail({ experience, variables, previewTheme }: {
  experience: EnquiryExperience; variables: Record<string, unknown>; previewTheme?: AlternativePreviewTheme;
}) {
  const copy = ENQUIRY_EXPERIENCES[experience];
  const audience = experience === 'configured' || experience === 'bespoke' || experience === 'help' ? 'residential' : experience;
  const model = buildAlternativeEmailModel(websiteAutoresponderTemplateIdFor(audience), variables);
  const brief = variables.customerBrief as CustomerBrief | undefined;
  const designUrl = brief?.design ? (typeof variables.submittedDesignUrl === 'string' && /^https:\/\/(www\.sanctuarypergolas\.co\.nz|[a-z0-9.-]+\.vercel\.app)\/configurator-preview\?open=1#design=/.test(variables.submittedDesignUrl) ? variables.submittedDesignUrl : customerDesignUrl(brief)) : undefined;
  const firstName = typeof variables.name === 'string' ? variables.name.trim().split(/\s+/)[0] : '';
  const rows = model.summary.filter(row => {
    if (row.value === 'Not supplied' || row.value === 'Not selected' || row.value === 'None selected') return false;
    if (row.label === 'Files received' && (row.value === '0' || model.attachmentLinks.length > 0)) return false;
    if (row.label === 'Your project note') return false;
    if (audience !== 'residential') return /phone|files/i.test(row.label);
    if (designUrl) return /location|phone|files/i.test(row.label);
    return true;
  });
  const steps = ENQUIRY_NEXT_STEPS[experience];
  const preferences = normalizeEnquiryProjectPreferences(variables.projectPreferences, experience === 'help' || experience === 'bespoke');
  const preferenceRows = [
    ...(preferences.preferredTiming ? [{ label: 'Preferred timing', value: preferences.preferredTiming }] : []),
    ...(preferences.budgetPreference === 'not-sure' ? [{ label: 'Your budget', value: 'Not sure yet' }] : []),
    ...(preferences.budgetHint ? [{ label: 'Your budget (NZD, including GST)', value: preferences.budgetHint }] : []),
  ];
  return <AlternativeEmailShell preview={copy.preheader} previewTheme={previewTheme}>
    <Section className="spx-surface spx-mobile-pad" style={{ background: THEME.elevated, padding: '32px', color: THEME.text }}>
      <Eyebrow>{copy.label}</Eyebrow>
      <Heading as="h1" className="spx-text" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing: '-1px' }}>{copy.subject}</Heading>
      <Text className="spx-text">{firstName ? `Hi ${firstName},` : 'Hello,'}</Text>
      <Text className="spx-muted" style={{ lineHeight: 1.7 }}>{copy.intro}</Text>
      {experience === 'configured' && <Text className="spx-text" style={{ lineHeight: 1.7 }}>Your site-measure request has been received. A visit is not booked yet; we’ll confirm a suitable time with you.</Text>}
      <Text className="spx-text" style={{ lineHeight: 1.7 }}>We typically respond within one working day.</Text>
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
      {preferenceRows.length > 0 && <Section style={{ margin: '24px 0' }}><Eyebrow>Your timing & preferences</Eyebrow><DetailRows rows={preferenceRows} /></Section>}
      <Section style={{ margin: '28px 0' }}><Eyebrow>What happens next</Eyebrow><StepRows steps={steps} /></Section>
      {rows.length > 0 && <Section style={{ margin: '24px 0' }}><Eyebrow>{experience === 'bespoke' ? 'Your initial preferences' : 'Enquiry details'}</Eyebrow>{experience === 'bespoke' && <Text className="spx-muted" style={{ fontSize: 12 }}>A starting point for our conversation. We’ll help you explore what suits your home.</Text>}<DetailRows rows={rows} /></Section>}
      <AttachmentList links={model.attachmentLinks} />
      <ReplyPanel heading="Want to add anything?" model={{ ...model, replyButtonLabel: 'Reply with photos or plans', replyPrompt: audience === 'professional' ? 'Reply to this email with any drawings, site details or questions you’d like us to consider.' : audience === 'commercial' ? 'Reply to this email with any photos, plans or timing requirements you’d like to share.' : 'Reply to this email with any photos, plans or ideas you’d like to share.' }} />
      <Text className="spx-text" style={{ margin: '24px 0 0', lineHeight: 1.7 }}>Thanks,<br />The Sanctuary team</Text>
    </Section>
  </AlternativeEmailShell>;
}
