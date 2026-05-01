import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { THEME } from '../theme';

const steps = [
  {
    title: 'Review',
    description: 'We check your dimensions, structure type, and selected options.',
  },
  {
    title: 'Consultation',
    description: 'One of our team will talk through the best approach for your space.',
  },
  {
    title: 'Next step',
    description: "We confirm what's needed to move toward a firm proposal.",
  },
];

export function NextSteps() {
  return (
    <Section style={{ margin: '2px 0 22px' }}>
      <Text style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>
        What happens next
      </Text>

      {steps.map((step) => (
        <Section
          key={step.title}
          style={{
            display: 'block',
            padding: '12px 0',
            borderTop: `1px solid ${THEME.border}`,
          }}
        >
          <Text style={{ margin: '0 0 3px', fontSize: 13, lineHeight: 1.45, fontWeight: 700 }}>
            {step.title}
          </Text>
          <Text style={{ margin: 0, fontSize: 13, color: THEME.muted, lineHeight: 1.6 }}>
            {step.description}
          </Text>
        </Section>
      ))}
    </Section>
  );
}
