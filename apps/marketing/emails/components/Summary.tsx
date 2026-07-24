import * as React from 'react';
import { Column, Row, Section, Text } from '@react-email/components';
import { THEME } from '../theme';

export function Summary(props: { title: string; rows: Array<{ label: string; value: string }> }) {
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
        {props.title}
      </Text>

      {props.rows.map((row, index) => (
        <Row
          key={`${row.label}-${index}`}
          style={{
            padding: '12px 0',
            borderTop: `1px solid ${index === 0 ? THEME.ruleStrong : THEME.rule}`,
          }}
        >
          <Column style={{ width: '35%', paddingRight: 14, verticalAlign: 'top' }}>
            <Text style={{ margin: 0, fontSize: 10, color: THEME.subtle, lineHeight: 1.5 }}>
              {row.label}
            </Text>
          </Column>
          <Column style={{ verticalAlign: 'top' }}>
            <Text style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: THEME.text }}>
              {row.value}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}
