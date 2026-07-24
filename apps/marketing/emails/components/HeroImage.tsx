import * as React from 'react';
import { Img, Section } from '@react-email/components';

export const ENQUIRY_HERO_IMAGE_URL =
  'https://www.sanctuarypergolas.co.nz/images/riverhead-gable-01.jpg';

export function HeroImage() {
  return (
    <Section style={{ margin: '0 0 28px' }}>
      <Img
        src={ENQUIRY_HERO_IMAGE_URL}
        alt="Timber-lined gable pergola by Sanctuary Pergolas"
        style={{
          display: 'block',
          width: '100%',
          maxWidth: '100%',
          height: 'auto',
          border: '0',
        }}
      />
      <Section
        style={{
          padding: '9px 0 0',
          borderTop: '1px solid #C7CAC3',
        }}
      >
        <span
          style={{
            color: '#6B6F68',
            fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
            fontSize: 9,
            lineHeight: 1.4,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Riverhead gable pergola · Designed and built by Sanctuary
        </span>
      </Section>
    </Section>
  );
}
