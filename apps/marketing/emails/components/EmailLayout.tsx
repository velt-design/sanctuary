import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import { THEME } from '../theme';

export function EmailLayout(props: { preview: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: THEME.canvas }}>
        <Container
          style={{
            maxWidth: THEME.maxWidth,
            margin: '0 auto',
            padding: '24px 12px',
            fontFamily: THEME.font,
            color: THEME.text,
          }}
        >
          <Section
            style={{
              padding: '22px 24px 20px',
              backgroundColor: THEME.warm,
              borderTop: `1px solid ${THEME.ruleStrong}`,
              borderRight: `1px solid ${THEME.rule}`,
              borderLeft: `1px solid ${THEME.rule}`,
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: 20,
                lineHeight: 0.92,
                letterSpacing: '-0.04em',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: THEME.text,
              }}
            >
              Sanctuary
            </Text>
            <Text
              style={{
                margin: '5px 0 0',
                fontSize: 8,
                lineHeight: 1,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: THEME.text,
              }}
            >
              Pergolas
            </Text>
          </Section>

          <Section
            style={{
              padding: '28px 24px 32px',
              backgroundColor: THEME.elevated,
              borderRight: `1px solid ${THEME.rule}`,
              borderLeft: `1px solid ${THEME.rule}`,
            }}
          >
            {props.children}
          </Section>

          <Section
            style={{
              padding: '24px',
              backgroundColor: THEME.inverse,
              border: `1px solid ${THEME.inverse}`,
            }}
          >
            <Text style={{ margin: 0, fontSize: 12, color: THEME.muted, lineHeight: 1.6 }}>
              <span
                style={{
                  color: THEME.inverseText,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                Sanctuary Pergolas
              </span>
              <br />
              <span style={{ color: '#BFC2BA' }}>
                Bespoke pergolas, built around the architecture.
              </span>
              <br />
              <br />
              <Link href="tel:+64228545633" style={{ color: THEME.inverseText, textDecoration: 'none' }}>
                022 854 5633
              </Link>
              <br />
              <Link
                href="mailto:info@sanctuarypergolas.co.nz"
                style={{ color: THEME.inverseText, textDecoration: 'none' }}
              >
                info@sanctuarypergolas.co.nz
              </Link>
              <br />
              <Link
                href="https://www.sanctuarypergolas.co.nz"
                style={{ color: '#BFC2BA', textDecoration: 'none' }}
              >
                sanctuarypergolas.co.nz
              </Link>
            </Text>
          </Section>

          <Hr style={{ borderColor: THEME.rule, margin: '14px 0 0' }} />
          <Text style={{ margin: '9px 2px 0', fontSize: 10, color: THEME.subtle, lineHeight: 1.5 }}>
            You're receiving this because you submitted an enquiry on our website.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
