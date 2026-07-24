import * as React from 'react';
import { Heading, Text } from '@react-email/components';
import { THEME } from '../theme';

export function EmailIntro(props: {
  eyebrow: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Text
        style={{
          margin: '0 0 14px',
          color: THEME.subtle,
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1.4,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {props.eyebrow}
      </Text>
      <Heading
        as="h1"
        style={{
          margin: '0 0 16px',
          color: THEME.text,
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '-0.045em',
        }}
      >
        {props.heading}
      </Heading>
      <Text style={{ margin: 0, color: THEME.muted, fontSize: 14, lineHeight: 1.7 }}>
        {props.children}
      </Text>
    </>
  );
}
