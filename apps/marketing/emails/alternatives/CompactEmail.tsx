import * as React from 'react';
import {
  Column,
  Heading,
  Row,
  Section,
  Text,
} from '@react-email/components';
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

export function CompactEmail(props: {
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
          padding: '29px 34px 34px',
          backgroundColor: THEME.elevated,
          borderRight: `1px solid ${THEME.rule}`,
          borderLeft: `1px solid ${THEME.rule}`,
        }}
      >
        <Row>
          <Column
            className="spx-mobile-block"
            style={{
              width: '56%',
              paddingRight: 24,
              verticalAlign: 'top',
            }}
          >
            <Eyebrow>{model.eyebrow}</Eyebrow>
            <Heading
              as="h1"
              className="spx-compact-heading spx-text"
              style={{
                margin: '0 0 13px',
                color: THEME.text,
                fontSize: 31,
                fontWeight: 700,
                letterSpacing: '-0.045em',
                lineHeight: 1.04,
              }}
            >
              {model.heading}
            </Heading>
            <Text
              className="spx-muted"
              style={{
                margin: 0,
                color: THEME.muted,
                fontSize: 12,
                lineHeight: 1.65,
              }}
            >
              {model.intro}
            </Text>
            <Text
              className="spx-subtle"
              style={{
                margin: '9px 0 0',
                color: THEME.subtle,
                fontSize: 10,
                lineHeight: 1.55,
              }}
            >
              {model.reassurance}
            </Text>
          </Column>
          <Column
            className="spx-mobile-block spx-mobile-top-space"
            style={{ width: '44%', verticalAlign: 'top' }}
          >
            <ProjectImage model={model} />
          </Column>
        </Row>

        {model.baseInvestment ? (
          <Section style={{ margin: '24px 0 0' }}>
            <InvestmentBlock model={model} compact />
            <EstimateNote model={model} />
          </Section>
        ) : null}

        <Row style={{ marginTop: 26 }}>
          <Column
            className="spx-mobile-block"
            style={{
              width: '49%',
              paddingRight: 22,
              verticalAlign: 'top',
            }}
          >
            <Eyebrow>What happens next</Eyebrow>
            <StepRows steps={model.steps} compact />
          </Column>
          <Column
            className="spx-mobile-block spx-mobile-top-space"
            style={{
              width: '51%',
              paddingLeft: 2,
              verticalAlign: 'top',
            }}
          >
            <Eyebrow>Your brief</Eyebrow>
            <DetailRows rows={model.summary} compact />
          </Column>
        </Row>

        <Section style={{ margin: '26px 0 0' }}>
          <AttachmentList links={model.attachmentLinks} compact />
          <ReplyPanel model={model} compact />
        </Section>
      </Section>
    </AlternativeEmailShell>
  );
}
