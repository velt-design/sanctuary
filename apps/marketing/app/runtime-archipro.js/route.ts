import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export function GET() {
  const js = `
;(function () {
  try {
    if (window.__spArchiproRuntimeLoaded) return;
    window.__spArchiproRuntimeLoaded = true;

    window.ApData = window.ApData || [];
    function apa(){ window.ApData.push(arguments); }
    apa('id','sanctuary-pergolas');

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://pixel.archipro.co.nz/ap-analytics.js';
    document.head.appendChild(s);
  } catch (e) {}
})();
`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000',
    },
  });
}
