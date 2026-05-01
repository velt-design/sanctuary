'use client';

import MaterialSection from '@/components/home/MaterialSection';

export default function AcrylicSection() {
  return (
    <MaterialSection
      headingId="acrylic-heading"
      eyebrow="Roofing"
      title="Acrylic"
      intro="Clear or tinted acrylic sheets that keep spaces bright and open while still providing rain and UV protection."
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
          text: 'Strong rain protection with heat and glare control that varies by selected tint.',
        },
        {
          label: 'Light',
          text: 'High daylight transmission; clear sheets feel almost open, while tints soften brightness.',
        },
        {
          label: 'Maintenance',
          text: 'Low upkeep with occasional washing; avoid abrasive cleaners to preserve long-term clarity.',
        },
      ]}
    />
  );
}
