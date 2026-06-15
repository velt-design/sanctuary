'use client';

import MaterialSection from '@/components/home/MaterialSection';

export default function TimberSection() {
  return (
    <MaterialSection
      headingId="timber-heading"
      eyebrow="Roofing"
      title="Timber"
      intro="A lined timber ceiling that makes the pergola feel like an outdoor room, with warmth and depth that ties into interior finishes."
      bestFor="Premium outdoor living rooms"
      image={{
        src: '/images/timber-gable-ceiling.jpg',
        alt: 'Close-up of a timber-lined gable pergola ceiling against a blue sky',
        quality: 72,
      }}
      characteristics={[
        {
          label: 'Look/feel',
          text: 'Natural grain and warm tone with a finished ceiling effect that reads as part of the home, not an add-on.',
        },
        {
          label: 'Comfort',
          text: 'Strong heat and glare reduction, plus noticeably softer rain noise than clear roofing alone.',
        },
        {
          label: 'Light',
          text: 'More opaque than acrylic, often paired with targeted skylight strips to keep daylight balanced.',
        },
        {
          label: 'Maintenance',
          text: 'Requires periodic oiling or staining plus routine cleaning to maintain appearance over time.',
        },
      ]}
    />
  );
}
