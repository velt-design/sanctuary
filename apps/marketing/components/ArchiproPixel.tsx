"use client";

import Script from 'next/script';

export default function ArchiproPixel() {
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

