import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export function GET() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
  const js = `
;(function () {
  try {
    var gaId = ${JSON.stringify(gaId)};
    if (!gaId) return;
    if (typeof window.gtag === 'function') return;

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    document.head.appendChild(s);

    window.gtag('js', new Date());
    window.gtag('config', gaId, { anonymize_ip: true, transport_type: 'beacon' });
  } catch (e) {}
})();
`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

