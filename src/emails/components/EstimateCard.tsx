import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { THEME } from '../theme';

export function EstimateCard(props: { title: string; lines: string[]; note?: string }) {
  return (
    <Section
      style={{
        margin: '10px 0 14px',
        padding: '14px 14px',
        backgroundColor: '#FFFFFF',
        border: `1px solid ${THEME.border}`,
        borderLeft: `4px solid ${THEME.accent}`,
      }}
    >
      <Text style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600 }}>
        {props.title}
      </Text>

      {props.lines.map((line, idx) => (
        <Text key={idx} style={{ margin: '0 0 6px', fontSize: 13, lineHeight: 1.5 }}>
          {line}
        </Text>
      ))}

      {props.note ? (
        <Text style={{ margin: '10px 0 0', fontSize: 12, color: THEME.muted, lineHeight: 1.5 }}>
          {props.note}
        </Text>
      ) : null}
    </Section>
  );
}
