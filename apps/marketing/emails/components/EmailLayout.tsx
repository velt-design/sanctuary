import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Html,
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
      <Body style={{ margin: 0, padding: 0, backgroundColor: THEME.bg }}>
        <Container
          style={{
            maxWidth: THEME.maxWidth,
            margin: '0 auto',
            padding: '28px 16px',
            fontFamily: THEME.font,
            color: THEME.text,
          }}
        >
          <Section
            style={{
              padding: '16px 18px 18px',
              backgroundColor: THEME.card,
              border: `1px solid ${THEME.border}`,
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.35,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: THEME.text,
              }}
            >
              SANCTUARY PERGOLAS
            </Text>

            <Hr style={{ borderColor: THEME.border, margin: '12px 0 18px' }} />

            {props.children}

            <Hr style={{ borderColor: THEME.border, margin: '24px 0 18px' }} />

            <Text style={{ margin: 0, fontSize: 12, color: THEME.muted, lineHeight: 1.6 }}>
              <span style={{ color: THEME.text, fontWeight: 600 }}>Sanctuary Pergolas</span>
              <br />
              Outdoor living, designed around your home.
              <br />
              Phone: +64 9 634 9482
              <br />
              Email: info@sanctuarypergolas.co.nz
            </Text>
          </Section>

          <Text style={{ margin: '10px 2px 0', fontSize: 11, color: THEME.muted, lineHeight: 1.5 }}>
            You're receiving this because you submitted an enquiry on our website.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
