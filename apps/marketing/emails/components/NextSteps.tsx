import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { THEME } from '../theme';

const steps = [
  'We review your enquiry',
  'We talk through your options',
  'We confirm the best next step',
];

export function NextSteps() {
  return (
    <Section style={{ margin: '0 0 18px' }}>
      <Text style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>
        What happens next
      </Text>

      {steps.map((step, index) => (
        <Section
          key={step}
          style={{
            display: 'block',
            padding: '10px 12px',
            backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
            border: `1px solid ${THEME.border}`,
            borderBottom: index === steps.length - 1 ? `1px solid ${THEME.border}` : '0',
          }}
        >
          <Text style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            <span style={{ color: THEME.accent, fontWeight: 700 }}>{index + 1}. </span>
            {step}
          </Text>
        </Section>
      ))}
    </Section>
  );
}
