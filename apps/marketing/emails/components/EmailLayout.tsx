import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import { THEME } from '../theme';

export const EMAIL_LOGO_URL = 'https://www.sanctuarypergolas.co.nz/images/email-logo.png';

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
              padding: '24px 18px 18px',
              backgroundColor: THEME.card,
              border: `1px solid ${THEME.border}`,
            }}
          >
            <Img
              src={EMAIL_LOGO_URL}
              alt="Sanctuary Pergolas"
              width="56"
              height="56"
              style={{
                display: 'block',
                width: 56,
                height: 56,
                margin: '0 0 12px',
                border: 0,
              }}
            />
            <Text
              style={{
                margin: '0 0 18px',
                fontSize: 13,
                lineHeight: 1.55,
                color: THEME.muted,
              }}
            >
              Outdoor living, designed around your home.
            </Text>

            <Hr style={{ borderColor: THEME.border, margin: '0 0 22px' }} />

            {props.children}

            <Hr style={{ borderColor: THEME.border, margin: '24px 0 18px' }} />

            <Text style={{ margin: 0, fontSize: 12, color: THEME.muted, lineHeight: 1.6 }}>
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
