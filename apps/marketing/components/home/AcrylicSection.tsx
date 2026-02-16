'use client';

import MaterialSection from '@/components/home/MaterialSection';

export default function AcrylicSection() {
  return (
    <MaterialSection
      headingId="acrylic-heading"
      eyebrow="Roofing"
      title="Acrylic"
      intro="Clear or tinted acrylic sheets that keep the pergola light and open while blocking UV and rain."
      showTopBorder={false}
      showBottomBorder={false}
      image={{
        src: '/images/project-dairy-flat-02.jpg',
        alt: 'Acrylic roof over an outdoor dining area',
      }}
      characteristics={[
        {
          label: 'Look/feel',
          text: 'Light, crisp roofline that keeps sky views and a clean, modern read.',
        },
        {
          label: 'Comfort',
          text: 'Good rain protection with moderate heat and glare control depending on tint.',
        },
        {
          label: 'Light',
          text: 'High daylight transmission; clear feels almost open, tints soften brightness and reduce glare.',
        },
        {
          label: 'Maintenance',
          text: 'Occasional washing to remove dust and debris; no recoating required, but avoid harsh abrasives to keep the surface clear.',
        },
      ]}
    />
  );
}
