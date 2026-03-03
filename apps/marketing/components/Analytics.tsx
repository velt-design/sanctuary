"use client";

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { useConsent } from '@/components/ConsentProvider';

export default function Analytics() {
  const { consent } = useConsent();
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!consent.analytics) {
      setShouldLoad(false);
      return;
    }

    let timerId: number | null = null;

    const schedule = () => {
      timerId = window.setTimeout(() => setShouldLoad(true), 1600);
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
  }, [consent.analytics]);

  if (!consent.analytics || !shouldLoad) return null;

  return <Script id="sp-runtime-ga" src="/runtime-ga.js" strategy="afterInteractive" />;
}
