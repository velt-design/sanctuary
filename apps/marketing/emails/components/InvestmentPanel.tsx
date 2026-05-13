import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { THEME } from '../theme';

export const INVESTMENT_PANEL_BACKGROUND = '#20211D';

export function formatInvestmentAmount(
  range: { lowIncGst: number; highIncGst: number },
  formatMoney: (value: number) => string,
) {
  return range.lowIncGst === range.highIncGst
    ? formatMoney(range.lowIncGst)
    : `${formatMoney(range.lowIncGst)} - ${formatMoney(range.highIncGst)}`;
}

export function InvestmentPanel(props: {
  baseRange: string;
  blindsRange?: string;
  note: string;
}) {
  return (
    <>
      <Section
        style={{
          margin: '18px 0 10px',
          padding: '24px 24px 22px',
          backgroundColor: INVESTMENT_PANEL_BACKGROUND,
          border: '1px solid #2D2F29',
        }}
      >
        <Text
          style={{
            margin: '0 0 10px',
            fontSize: 11,
            color: '#C8C5BA',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          Indicative installed investment
        </Text>

        <Text
          style={{
            margin: '0 0 6px',
            fontSize: 32,
            lineHeight: 1.15,
            fontWeight: 600,
            color: '#FFFFFF',
          }}
        >
          {props.baseRange}
        </Text>
        <Text style={{ margin: '0 0 18px', fontSize: 13, color: '#DCD8CC', lineHeight: 1.55 }}>
          Pergola structure, installed, incl. GST
        </Text>

        {props.blindsRange ? (
          <Section
            style={{
              margin: 0,
              padding: '16px 0 0',
              borderTop: '1px solid #45463E',
            }}
          >
            <Text style={{ margin: '0 0 5px', fontSize: 12, color: '#C8C5BA', lineHeight: 1.5 }}>
              Blinds add-on
            </Text>
            <Text style={{ margin: 0, fontSize: 19, fontWeight: 600, color: '#FFFFFF', lineHeight: 1.35 }}>
              {props.blindsRange}
            </Text>
          </Section>
        ) : null}
      </Section>

      <Text style={{ margin: '0 0 22px', fontSize: 12, color: THEME.muted, lineHeight: 1.65 }}>
        {props.note}
      </Text>
    </>
  );
}
