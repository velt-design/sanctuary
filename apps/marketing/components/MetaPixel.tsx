"use client";

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { useConsent } from '@/components/ConsentProvider';

export default function MetaPixel() {
  const { consent } = useConsent();
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!consent.marketing) {
      setShouldLoad(false);
      return;
    }

    let timerId: number | null = null;

    const schedule = () => {
      timerId = window.setTimeout(() => setShouldLoad(true), 2800);
    };

    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }

    return () => {
      window.removeEventListener('load', schedule);
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [consent.marketing]);

  if (!consent.marketing || !shouldLoad) return null;

  return <Script id="sp-runtime-meta" src="/runtime-meta.js" strategy="afterInteractive" />;
}
