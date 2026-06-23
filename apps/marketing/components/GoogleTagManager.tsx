import Script from 'next/script';

const FALLBACK_GTM_CONTAINER_ID = 'GTM-W438QM7H';
const GTM_CONTAINER_ID = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID || FALLBACK_GTM_CONTAINER_ID;

function getContainerId(): string | null {
  const id = GTM_CONTAINER_ID.trim();
  return /^GTM-[A-Z0-9]+$/i.test(id) ? id : null;
}

export default function GoogleTagManager() {
  const containerId = getContainerId();
  if (!containerId) return null;

  return (
    <>
      <Script
        id="sp-gtm-consent-default"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
if (typeof window.gtag !== 'function') {
  window.gtag = function gtag(){ window.dataLayer.push(arguments); };
}
window.gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500
});
`,
        }}
      />
      <Script
        id="sp-gtm"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${JSON.stringify(containerId)});
`,
        }}
      />
    </>
  );
}

export function GoogleTagManagerNoScript() {
  const containerId = getContainerId();
  if (!containerId) return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(containerId)}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
