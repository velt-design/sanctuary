import * as React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { THEME } from '../theme';

export function ReplyInvitation(props: { copy: string }) {
  return (
    <Section
      style={{
        margin: '4px 0 0',
        padding: '22px',
        backgroundColor: THEME.warm,
        borderTop: `1px solid ${THEME.ruleStrong}`,
        borderBottom: `1px solid ${THEME.rule}`,
      }}
    >
      <Text
        style={{
          margin: '0 0 8px',
          fontSize: 19,
          lineHeight: 1.2,
          letterSpacing: '-0.025em',
          fontWeight: 700,
          color: THEME.text,
        }}
      >
        Add anything useful.
      </Text>
      <Text style={{ margin: '0 0 16px', fontSize: 12, color: THEME.muted, lineHeight: 1.65 }}>
        {props.copy}
      </Text>
      <Button
        href="mailto:info@sanctuarypergolas.co.nz"
        style={{
          display: 'inline-block',
          padding: '13px 18px',
          backgroundColor: THEME.accent,
          border: `1px solid ${THEME.accent}`,
          borderRadius: 0,
          color: THEME.inverseText,
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '0.1em',
          textDecoration: 'none',
          textTransform: 'uppercase',
        }}
      >
        Reply to Sanctuary
      </Button>
    </Section>
  );
}
