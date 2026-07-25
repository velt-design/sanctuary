import * as React from 'react';
import { Heading, Section, Text } from '@react-email/components';
import { THEME } from '../theme';
import type { AlternativePreviewTheme } from './AlternativeEmailShell';
import { AlternativeEmailShell } from './AlternativeEmailShell';
import type { AlternativeEmailModel } from './alternativeEmailModel';
import {
  AttachmentList,
  DetailRows,
  EstimateNote,
  Eyebrow,
  InvestmentBlock,
  ProjectImage,
  ReplyPanel,
  StepRows,
} from './AlternativeEmailParts';

export function EditorialRefinedEmail(props: {
  model: AlternativeEmailModel;
  preheader: string;
  previewTheme?: AlternativePreviewTheme;
}) {
  const { model } = props;
  return (
    <AlternativeEmailShell
      preview={props.preheader}
      previewTheme={props.previewTheme}
    >
      <Section
        className="spx-surface spx-rule spx-mobile-pad"
        style={{
          padding: '34px 34px 38px',
          backgroundColor: THEME.elevated,
          borderRight: `1px solid ${THEME.rule}`,
          borderLeft: `1px solid ${THEME.rule}`,
        }}
      >
        <Eyebrow>{model.eyebrow}</Eyebrow>
        <Heading
          as="h1"
          className="spx-heading spx-text"
          style={{
            margin: '0 0 15px',
            color: THEME.text,
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '-0.047em',
            lineHeight: 1.03,
          }}
        >
          {model.heading}
        </Heading>
        <Text
          className="spx-muted"
          style={{
            margin: 0,
            color: THEME.muted,
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          {model.intro}
        </Text>
        <Text
          className="spx-subtle"
          style={{
            margin: '11px 0 0',
            color: THEME.subtle,
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          {model.reassurance}
        </Text>

        <ProjectImage model={model} margin="28px 0 26px" />

        <InvestmentBlock model={model} />
        <EstimateNote model={model} />

        <Section style={{ margin: '29px 0 28px' }}>
          <Eyebrow>What happens next</Eyebrow>
          <StepRows steps={model.steps} />
        </Section>

        <Section style={{ margin: '0 0 27px' }}>
          <Eyebrow>Your project details</Eyebrow>
          <DetailRows rows={model.summary} />
        </Section>

        <AttachmentList links={model.attachmentLinks} />
        <ReplyPanel model={model} />
      </Section>
    </AlternativeEmailShell>
  );
}
