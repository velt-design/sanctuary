import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { THEME } from '../theme';

export const INVESTMENT_PANEL_BACKGROUND = THEME.inverse;

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
  rangeLabel?: string;
}) {
  return (
    <>
      <Section
        className="sp-email-investment"
        style={{
          margin: '24px 0 12px',
          padding: '26px 24px 24px',
          backgroundColor: INVESTMENT_PANEL_BACKGROUND,
          border: `1px solid ${THEME.inverse}`,
        }}
      >
        <Text
          style={{
            margin: '0 0 12px',
            fontSize: 10,
            color: '#BFC2BA',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {props.rangeLabel ?? 'Indicative installed investment'}
        </Text>

        <Text
          style={{
            margin: '0 0 7px',
            fontSize: 34,
            lineHeight: 1.08,
            letterSpacing: '-0.035em',
            fontWeight: 700,
            color: THEME.inverseText,
          }}
        >
          {props.baseRange}
        </Text>
        <Text style={{ margin: '0 0 19px', fontSize: 12, color: '#CFD1CA', lineHeight: 1.55 }}>
          Pergola structure and installation, including GST
        </Text>

        {props.blindsRange ? (
          <Section
            style={{
              margin: 0,
              padding: '16px 0 0',
              borderTop: '1px solid #41443D',
            }}
          >
            <Text style={{ margin: '0 0 5px', fontSize: 10, color: '#BFC2BA', lineHeight: 1.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Outdoor blinds
            </Text>
            <Text style={{ margin: 0, fontSize: 20, fontWeight: 700, color: THEME.inverseText, lineHeight: 1.35 }}>
              {props.blindsRange}
            </Text>
          </Section>
        ) : null}
      </Section>

      <Text style={{ margin: '0 0 26px', fontSize: 11, color: THEME.subtle, lineHeight: 1.65 }}>
        {props.note}
      </Text>
    </>
  );
}
