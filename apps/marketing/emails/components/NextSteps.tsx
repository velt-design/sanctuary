import * as React from 'react';
import { Column, Row, Section, Text } from '@react-email/components';
import { THEME } from '../theme';

export type EmailNextStep = Readonly<{
  title: string;
  description: string;
}>;

export function NextSteps({ steps }: { steps: readonly EmailNextStep[] }) {
  return (
    <Section style={{ margin: '4px 0 28px' }}>
      <Text
        style={{
          margin: '0 0 12px',
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1.4,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: THEME.subtle,
        }}
      >
        What happens next
      </Text>

      {steps.map((step, index) => (
        <Row
          key={step.title}
          style={{
            padding: '15px 0',
            borderTop: `1px solid ${index === 0 ? THEME.ruleStrong : THEME.rule}`,
          }}
        >
          <Column style={{ width: 42, verticalAlign: 'top' }}>
            <Text style={{ margin: 0, fontSize: 10, color: THEME.subtle, lineHeight: 1.5 }}>
              {String(index + 1).padStart(2, '0')}
            </Text>
          </Column>
          <Column style={{ verticalAlign: 'top' }}>
            <Text style={{ margin: '0 0 4px', fontSize: 15, lineHeight: 1.35, fontWeight: 700 }}>
              {step.title}
            </Text>
            <Text style={{ margin: 0, fontSize: 12, color: THEME.muted, lineHeight: 1.65 }}>
              {step.description}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}
