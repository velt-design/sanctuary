"use client";

import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function WebVitals() {
  if (!GA_ID) return null;
  return (
    <>
      <Script
        id="wv-src"
        src="https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js"
        strategy="afterInteractive"
      />
      <Script id="wv-init" strategy="afterInteractive">
        {`
          (function(){
            if (!window.webVitals) return;
            function sendToGA(metric){
              var name = metric.name;
              var value = metric.value;
              var id = metric.id;
              var scaled = name === 'CLS' ? Math.round(value * 1000) : Math.round(value);
              if (typeof window.gtag !== 'function') return;
              window.gtag('event', name, {
                value: scaled,
                metric_id: id,
                metric_value: value,
                non_interaction: true,
                event_category: 'Web Vitals'
              });
            }
            window.webVitals.onCLS(sendToGA);
            window.webVitals.onLCP(sendToGA);
            window.webVitals.onINP(sendToGA);
            window.webVitals.onFID && window.webVitals.onFID(sendToGA);
            window.webVitals.onFCP && window.webVitals.onFCP(sendToGA);
            window.webVitals.onTTFB && window.webVitals.onTTFB(sendToGA);
          })();
        `}
      </Script>
    </>
  );
}

