"use client";

import Script from 'next/script';
import { useConsent } from '@/components/ConsentProvider';
import { toGtagConsentMode, type ConsentPreferences } from '@/lib/consent';
import type { TrackingBasis } from '@/lib/trackingRegion';

const FALLBACK_GTM_CONTAINER_ID = 'GTM-W438QM7H';
const GTM_CONTAINER_ID = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID || FALLBACK_GTM_CONTAINER_ID;

function getContainerId(): string | null {
  const id = GTM_CONTAINER_ID.trim();
  return /^GTM-[A-Z0-9]+$/i.test(id) ? id : null;
}

export function shouldLoadGoogleTagManager(
  consent: Pick<ConsentPreferences, 'analytics' | 'marketing'>,
  trackingBasis: TrackingBasis,
): boolean {
  // GTM may load after an explicit choice or the NZ regional default, with the
  // exact category state queued before the container.
  return trackingBasis !== 'none' && (consent.analytics || consent.marketing);
}

export default function GoogleTagManager() {
  const containerId = getContainerId();
  const { consent, trackingBasis } = useConsent();
  if (!containerId || !shouldLoadGoogleTagManager(consent, trackingBasis)) return null;

  const consentMode = toGtagConsentMode(consent);

  return (
    <>
      <Script
        id="sp-gtm-consent-before-load"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
if (typeof window.gtag !== 'function') {
  window.gtag = function gtag(){ window.dataLayer.push(arguments); };
}
window.gtag('consent', 'update', ${JSON.stringify(consentMode)});
`,
        }}
      />
      <Script
        id="sp-gtm"
        strategy="afterInteractive"
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
