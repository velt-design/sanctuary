"use client";

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { useConsent } from '@/components/ConsentProvider';

export default function ArchiproPixel() {
  const { consent } = useConsent();
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!consent.marketing) {
      setShouldLoad(false);
      return;
    }

    let timerId: number | null = null;

    const schedule = () => {
      timerId = window.setTimeout(() => setShouldLoad(true), 3600);
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

  return <Script id="sp-runtime-archipro" src="/runtime-archipro.js" strategy="afterInteractive" />;
}

