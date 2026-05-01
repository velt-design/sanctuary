import * as React from 'react';
import { Img, Section } from '@react-email/components';

export const ENQUIRY_HERO_IMAGE_URL = 'https://www.sanctuarypergolas.co.nz/images/riverhead-gable-01.jpg';

export function HeroImage() {
  return (
    <Section style={{ margin: '0 0 18px' }}>
      <Img
        src={ENQUIRY_HERO_IMAGE_URL}
        alt="Gable pergola by Sanctuary Pergolas"
        style={{
          display: 'block',
          width: '100%',
          maxWidth: '100%',
          height: 'auto',
          border: '0',
        }}
      />
    </Section>
  );
}
