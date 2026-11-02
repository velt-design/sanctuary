import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { THEME } from './theme';

export function submittedEmailContact(variables: Record<string, unknown>) {
  return (['phone', 'suburb'] as const).flatMap(key => {
    const value = variables[key];
    return typeof value === 'string' && value.trim()
      ? [{ label: key === 'phone' ? 'Phone' : 'Suburb', value: value.trim() }]
      : [];
  });
}

export function SubmittedContactDetails({ details }: {
  details: ReturnType<typeof submittedEmailContact>;
}) {
  if (!details.length) return null;
  return <Section style={{ margin: '20px 0' }}>
    {details.map(({ label, value }) => <Text key={label} className="spx-muted" style={{ margin: 0, color: THEME.muted, fontSize: 14, lineHeight: 1.65 }}>
      {`${label}: ${value}`}
    </Text>)}
  </Section>;
}
