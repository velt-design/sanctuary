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
      <Script
        id="wv-init"
        src="/web-vitals-init.js"
        strategy="afterInteractive"
      />
    </>
  );
}
