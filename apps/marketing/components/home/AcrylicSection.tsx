'use client';

import MaterialSection from '@/components/home/MaterialSection';

export default function AcrylicSection() {
  return (
    <MaterialSection
      headingId="acrylic-heading"
      eyebrow="Roofing"
      title="Acrylic"
      intro="Clear, opal or tinted acrylic sheets form a fixed overhead roof with different daylight and visual characteristics."
      bestFor="Bright, open courtyards"
      image={{
        src: '/images/dairy-flat-hero.jpg',
        alt: 'Acrylic roof over an outdoor dining area',
        quality: 50,
      }}
      characteristics={[
        {
          label: 'Look/feel',
          text: 'Light, crisp roofline that preserves sky views and a clean, modern look.',
        },
        {
          label: 'Comfort',
          text: 'Tint, opacity and any solid roof zones are selected around shade, glare and the rooms beside the pergola.',
        },
        {
          label: 'Light',
          text: 'Clear, opal and tinted sheets create different daylight conditions. Exact product data should be confirmed for the selected roof.',
        },
        {
          label: 'Maintenance',
          text: 'Cleaning and care should follow the current written guidance for the exact sheet product and site exposure.',
        },
      ]}
    />
  );
}
