"use client";

import { useEffect, useState } from 'react';
import Script from 'next/script';

export default function ArchiproPixel() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
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
  }, []);

  if (!shouldLoad) return null;

  return (
    <>
      <Script
        id="archipro-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.ApData = window.ApData || [];
function apa(){ window.ApData.push(arguments); }
apa('id','sanctuary-pergolas');
          `,
        }}
      />
      <Script
        id="archipro-src"
        src="https://pixel.archipro.co.nz/ap-analytics.js"
        strategy="afterInteractive"
      />
    </>
  );
}

