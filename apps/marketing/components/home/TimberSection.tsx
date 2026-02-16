'use client';

import MaterialSection from '@/components/home/MaterialSection';

export default function TimberSection() {
  return (
    <MaterialSection
      headingId="timber-heading"
      eyebrow="Roofing"
      title="Timber"
      intro="Visually it reads like an interior ceiling that's been extended outdoors, so it ties into timber floors, joinery and furniture and makes the pergola feel like a built-in room rather than a bolt-on cover."
      showTopBorder={false}
      showBottomBorder
      image={{
        src: '/images/project-warkworth-01.png',
        alt: 'Timber roofing over a Warkworth outdoor space',
      }}
      characteristics={[
        {
          label: 'Look/feel',
          text: 'Natural grain, warm colour and a finished ceiling effect; suits higher-end projects or where you want the pergola to feel like an extension of the interior.',
        },
        {
          label: 'Comfort',
          text: 'Insulated panels plus timber lining give strong heat and glare reduction vs acrylic alone and noticeably soften rain noise and general sound.',
        },
        {
          label: 'Light',
          text: "More solid/opaque than acrylic, so it's often combined with acrylic skylight strips in selected bays to keep daylight levels up.",
        },
        {
          label: 'Maintenance',
          text: "Needs periodic oiling or staining to keep the timber looking sharp, and occasional cleaning like any exterior timber; more upkeep than bare aluminium or acrylic but with a more premium, 'furnished' result.",
        },
      ]}
    />
  );
}
