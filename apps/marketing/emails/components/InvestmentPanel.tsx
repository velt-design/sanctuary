import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { THEME } from '../theme';

export function InvestmentPanel(props: {
  baseRange: string;
  blindsRange?: string;
  note: string;
}) {
  return (
    <Section
      style={{
        margin: '14px 0 18px',
        padding: '18px 18px 16px',
        backgroundColor: '#111111',
        border: '1px solid #111111',
      }}
    >
      <Text
        style={{
          margin: '0 0 8px',
          fontSize: 12,
          color: '#D6D6D6',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
        }}
      >
        Indicative installed investment
      </Text>

      <Text
        style={{
          margin: '0 0 4px',
          fontSize: 30,
          lineHeight: 1.18,
          fontWeight: 700,
          color: '#FFFFFF',
        }}
      >
        {props.baseRange}
      </Text>
      <Text style={{ margin: '0 0 14px', fontSize: 13, color: '#D6D6D6', lineHeight: 1.5 }}>
        Pergola structure, installed, incl. GST
      </Text>

      {props.blindsRange ? (
        <Section
          style={{
            margin: '0 0 14px',
            padding: '12px 0 0',
            borderTop: '1px solid #333333',
          }}
        >
          <Text style={{ margin: '0 0 4px', fontSize: 12, color: '#D6D6D6', lineHeight: 1.5 }}>
            Blinds add-on
          </Text>
          <Text style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.35 }}>
            {props.blindsRange}
          </Text>
        </Section>
      ) : null}

      <Text style={{ margin: 0, fontSize: 12, color: THEME.border, lineHeight: 1.55 }}>
        {props.note}
      </Text>
    </Section>
  );
}
