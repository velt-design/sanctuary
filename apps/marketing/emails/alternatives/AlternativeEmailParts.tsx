import * as React from 'react';
import {
  Button,
  Column,
  Img,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components';
import { THEME } from '../theme';
import type {
  AlternativeEmailModel,
  AlternativeEmailRow,
  AlternativeEmailStep,
} from './alternativeEmailModel';

export function Eyebrow(props: {
  children: React.ReactNode;
  inverse?: boolean;
}) {
  return (
    <Text
      className={props.inverse ? undefined : 'spx-subtle'}
      style={{
        margin: '0 0 13px',
        color: props.inverse ? '#bfc2ba' : THEME.subtle,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.14em',
        lineHeight: 1.45,
        textTransform: 'uppercase',
      }}
    >
      {props.children}
    </Text>
  );
}

export function ProjectImage(props: {
  model: AlternativeEmailModel;
  captionTone?: 'light' | 'inverse';
  margin?: string;
}) {
  const inverse = props.captionTone === 'inverse';
  const { hero } = props.model;
  return (
    <Section style={{ margin: props.margin ?? 0 }}>
      <Link
        href={hero.projectHref}
        style={{ display: 'block', textDecoration: 'none' }}
      >
        <Img
          src={hero.imageUrl}
          alt={hero.imageAlt}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            border: 0,
          }}
        />
      </Link>
      <Section
        className={
          inverse
            ? 'spx-rule'
            : 'spx-surface spx-rule-strong'
        }
        style={{
          padding: inverse ? '13px 18px 15px' : '12px 0 0',
          backgroundColor: inverse ? THEME.inverse : THEME.elevated,
          borderTop: `1px solid ${
            inverse ? '#41443d' : THEME.ruleStrong
          }`,
        }}
      >
        <Text
          className={inverse ? undefined : 'spx-subtle'}
          style={{
            margin: '0 0 3px',
            color: inverse ? '#bfc2ba' : THEME.subtle,
            fontSize: 9,
            letterSpacing: '0.12em',
            lineHeight: 1.4,
            textTransform: 'uppercase',
          }}
        >
          Completed Sanctuary project
        </Text>
        <Link
          href={hero.projectHref}
          className={inverse ? undefined : 'spx-link'}
          style={{
            color: inverse ? THEME.inverseText : THEME.text,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.45,
            textDecoration: 'none',
          }}
        >
          {hero.projectTitle} · {hero.location}
        </Link>
        <Text
          className={inverse ? undefined : 'spx-subtle'}
          style={{
            margin: '3px 0 0',
            color: inverse ? '#cfd1ca' : THEME.subtle,
            fontSize: 10,
            lineHeight: 1.5,
          }}
        >
          {hero.roofApproach}
        </Text>
      </Section>
    </Section>
  );
}

export function InvestmentBlock(props: {
  model: AlternativeEmailModel;
  tone?: 'inverse' | 'warm';
  compact?: boolean;
}) {
  if (!props.model.baseInvestment) return null;
  const inverse = props.tone !== 'warm';
  return (
    <Section
      className={
        inverse
          ? 'spx-rule'
          : 'spx-warm spx-rule-strong'
      }
      style={{
        padding: props.compact ? '20px' : '26px 24px',
        backgroundColor: inverse ? THEME.inverse : THEME.warm,
        border: `1px solid ${inverse ? THEME.inverse : THEME.ruleStrong}`,
      }}
    >
      <Text
        className={inverse ? undefined : 'spx-subtle'}
        style={{
          margin: '0 0 8px',
          color: inverse ? '#bfc2ba' : THEME.subtle,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.14em',
          lineHeight: 1.4,
          textTransform: 'uppercase',
        }}
      >
        Early installed estimate
      </Text>
      <Text
        className={inverse ? undefined : 'spx-text'}
        style={{
          margin: 0,
          color: inverse ? THEME.inverseText : THEME.text,
          fontSize: props.compact ? 27 : 34,
          fontWeight: 700,
          letterSpacing: '-0.035em',
          lineHeight: 1.08,
        }}
      >
        {props.model.baseInvestment}
      </Text>
      <Text
        className={inverse ? undefined : 'spx-muted'}
        style={{
          margin: '6px 0 0',
          color: inverse ? '#cfd1ca' : THEME.muted,
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        Pergola structure and installation, including GST
      </Text>
      {props.model.blindsInvestment ? (
        <Section
          className={inverse ? undefined : 'spx-rule'}
          style={{
            margin: '16px 0 0',
            padding: '14px 0 0',
            borderTop: `1px solid ${
              inverse ? '#41443d' : THEME.rule
            }`,
          }}
        >
          <Text
            className={inverse ? undefined : 'spx-subtle'}
            style={{
              margin: '0 0 4px',
              color: inverse ? '#bfc2ba' : THEME.subtle,
              fontSize: 9,
              letterSpacing: '0.1em',
              lineHeight: 1.45,
              textTransform: 'uppercase',
            }}
          >
            Optional outdoor blinds
          </Text>
          <Text
            className={inverse ? undefined : 'spx-text'}
            style={{
              margin: 0,
              color: inverse ? THEME.inverseText : THEME.text,
              fontSize: 19,
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          >
            {props.model.blindsInvestment}
          </Text>
        </Section>
      ) : null}
    </Section>
  );
}

export function EstimateNote({ model }: { model: AlternativeEmailModel }) {
  if (!model.estimateNote) return null;
  return (
    <Text
      className="spx-subtle"
      style={{
        margin: '11px 0 0',
        color: THEME.subtle,
        fontSize: 10,
        lineHeight: 1.65,
      }}
    >
      {model.estimateNote}
    </Text>
  );
}

export function StepRows(props: {
  steps: readonly AlternativeEmailStep[];
  compact?: boolean;
}) {
  return (
    <Section>
      {props.steps.map((step, index) => (
        <Row
          key={step.title}
          className={`spx-rule${index === 0 ? ' spx-rule-strong' : ''}`}
          style={{
            padding: props.compact ? '12px 0' : '15px 0',
            borderTop: `1px solid ${
              index === 0 ? THEME.ruleStrong : THEME.rule
            }`,
          }}
        >
          <Column style={{ width: 40, verticalAlign: 'top' }}>
            <Text
              className="spx-subtle"
              style={{
                margin: 0,
                color: THEME.subtle,
                fontSize: 10,
                lineHeight: 1.5,
              }}
            >
              {String(index + 1).padStart(2, '0')}
            </Text>
          </Column>
          <Column style={{ verticalAlign: 'top' }}>
            <Text
              className="spx-text"
              style={{
                margin: '0 0 3px',
                color: THEME.text,
                fontSize: props.compact ? 13 : 15,
                fontWeight: 700,
                lineHeight: 1.35,
              }}
            >
              {step.title}
            </Text>
            <Text
              className="spx-muted"
              style={{
                margin: 0,
                color: THEME.muted,
                fontSize: props.compact ? 11 : 12,
                lineHeight: 1.6,
              }}
            >
              {step.description}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

export function DetailRows(props: {
  rows: readonly AlternativeEmailRow[];
  compact?: boolean;
}) {
  return (
    <Section>
      {props.rows.map((row, index) => (
        <Row
          key={`${row.label}-${index}`}
          className={`spx-rule${index === 0 ? ' spx-rule-strong' : ''}`}
          style={{
            padding: props.compact ? '10px 0' : '12px 0',
            borderTop: `1px solid ${
              index === 0 ? THEME.ruleStrong : THEME.rule
            }`,
          }}
        >
          <Column
            style={{
              width: '34%',
              paddingRight: 14,
              verticalAlign: 'top',
            }}
          >
            <Text
              className="spx-subtle"
              style={{
                margin: 0,
                color: THEME.subtle,
                fontSize: 9,
                lineHeight: 1.5,
              }}
            >
              {row.label}
            </Text>
          </Column>
          <Column style={{ verticalAlign: 'top' }}>
            <Text
              className="spx-text"
              style={{
                margin: 0,
                color: THEME.text,
                fontSize: props.compact ? 11 : 12,
                lineHeight: 1.6,
              }}
            >
              {row.value}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

export function AttachmentList(props: {
  links: readonly { name: string; url: string }[];
  compact?: boolean;
}) {
  if (!props.links.length) return null;
  return (
    <Section
      className="spx-warm spx-rule-strong"
      style={{
        margin: '0 0 24px',
        padding: props.compact ? '15px' : '18px',
        backgroundColor: THEME.warm,
        borderTop: `1px solid ${THEME.ruleStrong}`,
        borderBottom: `1px solid ${THEME.rule}`,
      }}
    >
      <Text
        className="spx-text"
        style={{
          margin: '0 0 8px',
          color: THEME.text,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Files received with your enquiry
      </Text>
      <Text
        className="spx-muted"
        style={{
          margin: '0 0 8px',
          color: THEME.muted,
          fontSize: 11,
          lineHeight: 1.65,
        }}
      >
        {props.links.map((file, index) => (
          <React.Fragment key={`${file.name}-${index}`}>
            <Link
              href={file.url}
              className="spx-link"
              style={{ color: THEME.text, textDecoration: 'underline' }}
            >
              {file.name}
            </Link>
            {index < props.links.length - 1 ? <br /> : null}
          </React.Fragment>
        ))}
      </Text>
      <Text
        className="spx-subtle"
        style={{
          margin: 0,
          color: THEME.subtle,
          fontSize: 9,
          lineHeight: 1.5,
        }}
      >
        Secure download links expire seven days after the enquiry was
        submitted.
      </Text>
    </Section>
  );
}

export function ReplyPanel(props: {
  model: AlternativeEmailModel;
  tone?: 'warm' | 'inverse';
  compact?: boolean;
}) {
  const inverse = props.tone === 'inverse';
  return (
    <Section
      className={inverse ? undefined : 'spx-warm spx-rule-strong'}
      style={{
        padding: props.compact ? '19px' : '23px',
        backgroundColor: inverse ? THEME.inverse : THEME.warm,
        borderTop: `1px solid ${
          inverse ? '#41443d' : THEME.ruleStrong
        }`,
        borderBottom: `1px solid ${
          inverse ? THEME.inverse : THEME.rule
        }`,
      }}
    >
      <Text
        className={inverse ? undefined : 'spx-text'}
        style={{
          margin: '0 0 7px',
          color: inverse ? THEME.inverseText : THEME.text,
          fontSize: props.compact ? 17 : 20,
          fontWeight: 700,
          letterSpacing: '-0.025em',
          lineHeight: 1.2,
        }}
      >
        Have something useful to add?
      </Text>
      <Text
        className={inverse ? undefined : 'spx-muted'}
        style={{
          margin: '0 0 15px',
          color: inverse ? '#cfd1ca' : THEME.muted,
          fontSize: 11,
          lineHeight: 1.65,
        }}
      >
        {props.model.replyPrompt}
      </Text>
      <Button
        href="mailto:info@sanctuarypergolas.co.nz"
        className="spx-button"
        style={{
          display: 'inline-block',
          padding: '13px 17px',
          backgroundColor: THEME.accent,
          border: `1px solid ${THEME.accent}`,
          borderRadius: 0,
          color: THEME.inverseText,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          lineHeight: 1,
          textDecoration: 'none',
          textTransform: 'uppercase',
        }}
      >
        {props.model.replyButtonLabel}
      </Button>
    </Section>
  );
}
