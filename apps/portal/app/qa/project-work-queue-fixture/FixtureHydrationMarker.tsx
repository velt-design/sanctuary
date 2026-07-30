'use client';

import { useEffect, useState } from 'react';

export default function FixtureHydrationMarker() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return (
    <span
      className="visually-hidden"
      data-project-work-queue-fixture-hydrated={hydrated ? 'true' : 'false'}
    >
      Work queue fixture ready
    </span>
  );
}
