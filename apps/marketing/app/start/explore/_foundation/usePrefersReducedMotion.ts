'use client';

import * as React from 'react';

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);

    onChange();

    mq.addEventListener?.('change', onChange);
    mq.addListener?.(onChange);

    return () => {
      mq.removeEventListener?.('change', onChange);
      mq.removeListener?.(onChange);
    };
  }, []);

  return reduced;
}
