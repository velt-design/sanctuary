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
} from '@react-email/components';
import { THEME } from '../theme';

const emailCss = `
  :root {
    color-scheme: light;
    supported-color-schemes: light;
    background-color: ${THEME.canvas};
  }
  body,
  table,
  td,
  a {
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
  }
  table,
  td {
    mso-table-lspace: 0pt;
    mso-table-rspace: 0pt;
  }
  .spx-shell { overflow-wrap: anywhere; word-wrap: break-word; }
  .spx-button {
    border: 1px solid ${THEME.inverse} !important;
  }
  @media only screen and (max-width: 620px) {
    .spx-shell {
      padding: 0 !important;
    }
    .spx-mobile-pad {
      padding-left: 20px !important;
      padding-right: 20px !important;
    }
    .spx-mobile-block {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    .spx-mobile-top-space {
      padding-top: 20px !important;
    }
    .spx-heading {
      font-size: 30px !important;
    }
    .spx-image-heading {
      font-size: 31px !important;
    }
    .spx-compact-heading {
      font-size: 27px !important;
    }
    .spx-hide-mobile {
      display: none !important;
      max-height: 0 !important;
      overflow: hidden !important;
    }
  }
`;

export function AlternativeEmailShell(props: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <style>{emailCss}</style>
      </Head>
      <Preview>{props.preview}</Preview>
      <Body
        className="spx-body"
        style={{ margin: 0, padding: 0, backgroundColor: THEME.canvas }}
      >
        <Container
          className="spx-shell"
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
            className="spx-warm spx-rule spx-mobile-pad"
            style={{
              padding: '22px 34px 20px',
              backgroundColor: THEME.warm,
              borderTop: `2px solid ${THEME.accent}`,
              borderRight: `1px solid ${THEME.rule}`,
              borderLeft: `1px solid ${THEME.rule}`,
            }}
          >
            <Row>
              <Column style={{ verticalAlign: 'middle' }}>
                <Link
                  href="https://www.sanctuarypergolas.co.nz"
                  className="spx-link"
                  style={{ color: THEME.text, textDecoration: 'none' }}
                >
                  <Text
                    className="spx-text"
                    style={{
                      margin: 0,
                      color: THEME.text,
                      fontSize: 20,
                      fontWeight: 700,
                      letterSpacing: '-0.04em',
                      lineHeight: 0.92,
                      textTransform: 'uppercase',
                    }}
                  >
                    Sanctuary
                  </Text>
                  <Text
                    className="spx-text"
                    style={{
                      margin: '5px 0 0',
                      color: THEME.text,
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: '0.25em',
                      lineHeight: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    Pergolas
                  </Text>
                </Link>
              </Column>
            </Row>
          </Section>

          {props.children}

          <Section
            className="spx-rule spx-mobile-pad"
            style={{
              padding: '25px 34px',
              backgroundColor: THEME.inverse,
              border: `1px solid ${THEME.inverse}`,
            }}
          >
            <Text
              style={{
                margin: 0,
                color: THEME.inverseText,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                lineHeight: 1.4,
              }}
            >
              Sanctuary Pergolas
            </Text>
            <Text
              style={{
                margin: 0,
                color: THEME.inverseText,
                fontSize: 14,
                lineHeight: 1.75,
              }}
            >
              <Link
                href="tel:+64228545633"
                style={{
                  color: THEME.inverseText,
                  textDecoration: 'none',
                }}
              >
                022 854 5633
              </Link>
              <br />
              <Link
                href="mailto:info@sanctuarypergolas.co.nz"
                style={{
                  color: THEME.inverseText,
                  textDecoration: 'none',
                }}
              >
                info@sanctuarypergolas.co.nz
              </Link>
            </Text>
          </Section>

          <Text
            className="spx-subtle"
            style={{
              margin: '10px 2px 0',
              color: THEME.subtle,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            You&apos;re receiving this because you submitted an enquiry on our
            website.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
