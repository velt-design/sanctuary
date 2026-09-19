import * as React from 'react';
import { Heading, Section, Text } from '@react-email/components';
import { THEME } from '../theme';
import type { AlternativePreviewTheme } from './AlternativeEmailShell';
import { AlternativeEmailShell } from './AlternativeEmailShell';
import type { AlternativeEmailModel } from './alternativeEmailModel';
import { AttachmentList, EstimateNote, InvestmentBlock } from './AlternativeEmailParts';
import { ConfiguredEstimate } from '../ConfiguredEstimate';
import { ReceiptClosing, SubmittedDesign } from '../SubmittedDesign';

export function EditorialRefinedEmail(props: {
  model: AlternativeEmailModel;
  preheader: string;
  previewTheme?: AlternativePreviewTheme;
}) {
  const { model } = props;
  const dimensions = model.summary.find(row => row.label === 'Approximate dimensions' && row.value !== 'Not supplied');
  return (
    <AlternativeEmailShell preview={props.preheader} previewTheme={props.previewTheme}>
      <Section className="spx-surface spx-rule spx-mobile-pad" style={{ padding: '34px', backgroundColor: THEME.elevated, borderRight: '1px solid ' + THEME.rule, borderLeft: '1px solid ' + THEME.rule }}>
        <Heading as="h1" className="spx-heading spx-text" style={{ margin: '0 0 20px', color: THEME.text, fontSize: 30, fontWeight: 500, letterSpacing: '-1px', lineHeight: 1.15 }}>We’ve received your enquiry</Heading>
        <Text className="spx-text" style={{ margin: '0 0 24px', color: THEME.text, fontSize: 16, lineHeight: 1.65 }}>{model.reassurance}</Text>
        {model.submittedDesign || model.configuredEstimate !== undefined
          ? <ConfiguredEstimate value={model.configuredEstimate} />
          : <>
            {dimensions && model.baseInvestment && <Text className="spx-muted" style={{ margin: '0 0 12px', color: THEME.muted, fontSize: 14, lineHeight: 1.6 }}>{dimensions.value}</Text>}
            <InvestmentBlock model={model} tone="warm" />
            <EstimateNote model={model} />
          </>}
        <SubmittedDesign design={model.submittedDesign} />
        <AttachmentList links={model.attachmentLinks} compact />
        <ReceiptClosing filesReceivedCount={model.filesReceivedCount} hasDownloadLinks={model.attachmentLinks.length > 0} />
      </Section>
    </AlternativeEmailShell>
  );
}
