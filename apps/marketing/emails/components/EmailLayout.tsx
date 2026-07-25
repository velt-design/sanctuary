import * as React from 'react';
import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import { THEME } from '../theme';

export function EmailLayout(props: { preview: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head>
        <style>{`
          @media only screen and (max-width: 620px) {
            .sp-email-shell {
              padding: 0 !important;
            }
            .sp-email-header,
            .sp-email-content,
            .sp-email-footer {
              padding-left: 20px !important;
              padding-right: 20px !important;
            }
            .sp-email-content {
              padding-top: 20px !important;
              padding-bottom: 24px !important;
            }
            .sp-email-heading {
              font-size: 28px !important;
            }
            .sp-email-investment,
            .sp-email-reply {
              padding-left: 18px !important;
              padding-right: 18px !important;
            }
          }
          @media only screen and (max-width: 420px) {
            .sp-email-brand-note {
              display: none !important;
            }
          }
        `}</style>
      </Head>
      <Preview>{props.preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: THEME.canvas }}>
        <Container
          className="sp-email-shell"
          style={{
            width: '100%',
            maxWidth: THEME.maxWidth,
            margin: '0 auto',
            padding: '24px 12px',
            fontFamily: THEME.font,
            color: THEME.text,
          }}
        >
          <Section
            className="sp-email-header"
            style={{
              padding: '22px 34px 20px',
              backgroundColor: THEME.warm,
              borderTop: `1px solid ${THEME.accent}`,
              borderRight: `1px solid ${THEME.rule}`,
              borderLeft: `1px solid ${THEME.rule}`,
            }}
          >
            <Row>
              <Column style={{ verticalAlign: 'middle' }}>
                <Link
                  href="https://www.sanctuarypergolas.co.nz"
                  style={{ color: THEME.text, textDecoration: 'none' }}
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
                </Link>
              </Column>
              <Column
                className="sp-email-brand-note"
                style={{ width: 250, verticalAlign: 'middle', textAlign: 'right' }}
              >
                <Text
                  style={{
                    margin: 0,
                    color: THEME.subtle,
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: 1.5,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  Auckland · Design · Build · Install
                </Text>
              </Column>
            </Row>
          </Section>

          <Section
            className="sp-email-content"
            style={{
              padding: '32px 34px 38px',
              backgroundColor: THEME.elevated,
              borderRight: `1px solid ${THEME.rule}`,
              borderLeft: `1px solid ${THEME.rule}`,
            }}
          >
            {props.children}
          </Section>

          <Section
            className="sp-email-footer"
            style={{
              padding: '26px 34px',
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
