import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { THEME } from '../theme';

export function Summary(props: { title: string; rows: Array<{ label: string; value: string }> }) {
  return (
    <Section style={{ margin: '8px 0 20px' }}>
      <Text style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>
        {props.title}
      </Text>

      <Section style={{ border: `1px solid ${THEME.border}`, backgroundColor: '#FBFAF7' }}>
        {props.rows.map((row, idx) => (
          <Section
            key={idx}
            style={{
              display: 'block',
              padding: '9px 12px',
              backgroundColor: '#FBFAF7',
              borderBottom: idx === props.rows.length - 1 ? 'none' : `1px solid ${THEME.border}`,
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: 10,
                color: THEME.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              {row.label}
            </Text>
            <Text style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.55 }}>
              {row.value}
            </Text>
          </Section>
        ))}
      </Section>
    </Section>
  );
}
