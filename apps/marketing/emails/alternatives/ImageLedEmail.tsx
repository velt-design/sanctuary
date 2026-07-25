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

function priorityFacts(model: AlternativeEmailModel) {
  const wanted = ['Project location', 'Project area', 'Pergola form', 'Roof approach'];
  return model.summary.filter((row) => wanted.includes(row.label)).slice(0, 3);
}

export function ImageLedEmail(props: {
  model: AlternativeEmailModel;
  preheader: string;
  previewTheme?: AlternativePreviewTheme;
}) {
  const { model } = props;
  const facts = priorityFacts(model);

  return (
    <AlternativeEmailShell
      preview={props.preheader}
      previewTheme={props.previewTheme}
    >
      <Section
        className="spx-rule"
        style={{
          backgroundColor: THEME.inverse,
          borderRight: `1px solid ${THEME.inverse}`,
          borderLeft: `1px solid ${THEME.inverse}`,
        }}
      >
        <ProjectImage model={model} captionTone="inverse" />
      </Section>

      <Section
        className="spx-rule spx-mobile-pad"
        style={{
          padding: '31px 34px 33px',
          backgroundColor: THEME.inverse,
          borderRight: `1px solid ${THEME.inverse}`,
          borderLeft: `1px solid ${THEME.inverse}`,
        }}
      >
        <Eyebrow inverse>{model.eyebrow}</Eyebrow>
        <Heading
          as="h1"
          className="spx-image-heading"
          style={{
            margin: '0 0 14px',
            color: THEME.inverseText,
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: '-0.047em',
            lineHeight: 1.02,
          }}
        >
          {model.heading}
        </Heading>
        <Text
          style={{
            margin: 0,
            color: '#d7d9d2',
            fontSize: 14,
            lineHeight: 1.68,
          }}
        >
          {model.intro}
        </Text>
        <Text
          style={{
            margin: '11px 0 0',
            color: '#bfc2ba',
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          {model.reassurance}
        </Text>
      </Section>

      <Section
        className="spx-neutral spx-rule spx-mobile-pad"
        style={{
          padding: '23px 34px',
          backgroundColor: THEME.neutral,
          borderRight: `1px solid ${THEME.rule}`,
          borderLeft: `1px solid ${THEME.rule}`,
        }}
      >
        <Row>
          {facts.map((fact, index) => (
            <Column
              key={fact.label}
              className={`spx-mobile-block${index ? ' spx-mobile-top-space' : ''}`}
              style={{
                width: `${100 / Math.max(facts.length, 1)}%`,
                paddingRight: index < facts.length - 1 ? 16 : 0,
                verticalAlign: 'top',
              }}
            >
              <Text
                className="spx-subtle"
                style={{
                  margin: '0 0 4px',
                  color: THEME.subtle,
                  fontSize: 9,
                  letterSpacing: '0.09em',
                  lineHeight: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                {fact.label}
              </Text>
              <Text
                className="spx-text"
                style={{
                  margin: 0,
                  color: THEME.text,
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1.45,
                }}
              >
                {fact.value}
              </Text>
            </Column>
          ))}
        </Row>
      </Section>

      <Section
        className="spx-surface spx-rule spx-mobile-pad"
        style={{
          padding: '31px 34px 38px',
          backgroundColor: THEME.elevated,
          borderRight: `1px solid ${THEME.rule}`,
          borderLeft: `1px solid ${THEME.rule}`,
        }}
      >
        <InvestmentBlock model={model} tone="warm" />
        <EstimateNote model={model} />

        <Section style={{ margin: model.baseInvestment ? '30px 0 28px' : '0 0 28px' }}>
          <Eyebrow>From enquiry to proposal</Eyebrow>
          <StepRows steps={model.steps} />
        </Section>

        <Section style={{ margin: '0 0 27px' }}>
          <Eyebrow>Full brief received</Eyebrow>
          <DetailRows rows={model.summary} />
        </Section>

        <AttachmentList links={model.attachmentLinks} />
        <ReplyPanel model={model} tone="inverse" />
      </Section>
    </AlternativeEmailShell>
  );
}
