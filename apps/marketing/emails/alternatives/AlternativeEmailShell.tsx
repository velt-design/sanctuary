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

export type AlternativePreviewTheme = 'light' | 'dark';

const emailCss = `
  :root {
    color-scheme: light dark;
    supported-color-schemes: light dark;
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
  .spx-button {
    border: 1px solid ${THEME.accent} !important;
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
  @media (prefers-color-scheme: dark) {
    html { background-color: #11130f !important; }
    .spx-body { background-color: #11130f !important; }
    .spx-shell { color: #f2f2ed !important; }
    .spx-surface { background-color: #1c1f1a !important; }
    .spx-warm { background-color: #242820 !important; }
    .spx-neutral { background-color: #2a2d27 !important; }
    .spx-text { color: #f2f2ed !important; }
    .spx-muted { color: #c7cabf !important; }
    .spx-subtle { color: #a5aa9e !important; }
    .spx-rule { border-color: #3a3f37 !important; }
    .spx-rule-strong { border-color: #555b50 !important; }
    .spx-link { color: #f2f2ed !important; }
    .spx-button {
      background-color: #65715b !important;
      border-color: #9aa78d !important;
      color: #ffffff !important;
    }
  }
  html.sp-preview-dark { background-color: #11130f !important; }
  [data-ogsc] .spx-body,
  html.sp-preview-dark .spx-body { background-color: #11130f !important; }
  [data-ogsc] .spx-shell,
  html.sp-preview-dark .spx-shell { color: #f2f2ed !important; }
  [data-ogsc] .spx-surface,
  html.sp-preview-dark .spx-surface { background-color: #1c1f1a !important; }
  [data-ogsc] .spx-warm,
  html.sp-preview-dark .spx-warm { background-color: #242820 !important; }
  [data-ogsc] .spx-neutral,
  html.sp-preview-dark .spx-neutral { background-color: #2a2d27 !important; }
  [data-ogsc] .spx-text,
  html.sp-preview-dark .spx-text { color: #f2f2ed !important; }
  [data-ogsc] .spx-muted,
  html.sp-preview-dark .spx-muted { color: #c7cabf !important; }
  [data-ogsc] .spx-subtle,
  html.sp-preview-dark .spx-subtle { color: #a5aa9e !important; }
  [data-ogsc] .spx-rule,
  html.sp-preview-dark .spx-rule { border-color: #3a3f37 !important; }
  [data-ogsc] .spx-rule-strong,
  html.sp-preview-dark .spx-rule-strong { border-color: #555b50 !important; }
  [data-ogsc] .spx-link,
  html.sp-preview-dark .spx-link { color: #f2f2ed !important; }
  [data-ogsc] .spx-button,
  html.sp-preview-dark .spx-button {
    background-color: #65715b !important;
    border-color: #9aa78d !important;
    color: #ffffff !important;
  }
  html.sp-preview-light { background-color: #e9eae6 !important; }
  html.sp-preview-light .spx-body { background-color: #e9eae6 !important; }
  html.sp-preview-light .spx-shell { color: #111210 !important; }
  html.sp-preview-light .spx-surface { background-color: #f8f8f5 !important; }
  html.sp-preview-light .spx-warm { background-color: #f1f0eb !important; }
  html.sp-preview-light .spx-neutral { background-color: #e1e3de !important; }
  html.sp-preview-light .spx-text { color: #111210 !important; }
  html.sp-preview-light .spx-muted { color: #555852 !important; }
  html.sp-preview-light .spx-subtle { color: #6b6f68 !important; }
  html.sp-preview-light .spx-rule { border-color: #c7cac3 !important; }
  html.sp-preview-light .spx-rule-strong { border-color: #aeb2aa !important; }
  html.sp-preview-light .spx-link { color: #111210 !important; }
  html.sp-preview-light .spx-button {
    background-color: ${THEME.accent} !important;
    border-color: ${THEME.accent} !important;
    color: #f4f4f0 !important;
  }
`;

export function AlternativeEmailShell(props: {
  preview: string;
  previewTheme?: AlternativePreviewTheme;
  children: React.ReactNode;
}) {
  return (
    <Html
      lang="en"
      className={
        props.previewTheme ? `sp-preview-${props.previewTheme}` : undefined
      }
    >
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
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
              <Column
                className="spx-hide-mobile"
                style={{
                  width: 260,
                  verticalAlign: 'middle',
                  textAlign: 'right',
                }}
              >
                <Text
                  className="spx-subtle"
                  style={{
                    margin: 0,
                    color: THEME.subtle,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    lineHeight: 1.5,
                    textTransform: 'uppercase',
                  }}
                >
                  Auckland · Design · Build · Install
                </Text>
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
                margin: '5px 0 16px',
                color: '#cfd1ca',
                fontSize: 11,
                lineHeight: 1.55,
              }}
            >
              Bespoke pergolas, designed and built around the architecture.
            </Text>
            <Text
              style={{
                margin: 0,
                color: THEME.inverseText,
                fontSize: 11,
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
              {'  ·  '}
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
              fontSize: 10,
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
