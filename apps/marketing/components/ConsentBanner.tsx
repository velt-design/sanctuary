"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useConsent } from '@/components/ConsentProvider';

export default function ConsentBanner() {
  const { consent, hasStoredChoice, bannerOpen, setConsent, openBanner, closeBanner } = useConsent();
  const [analytics, setAnalytics] = useState(consent.analytics);
  const [marketing, setMarketing] = useState(consent.marketing);

  useEffect(() => {
    setAnalytics(consent.analytics);
    setMarketing(consent.marketing);
  }, [consent.analytics, consent.marketing]);

  const savePreferences = () => {
    setConsent({ analytics, marketing });
  };

  const acceptAll = () => {
    setConsent({ analytics: true, marketing: true });
  };

  const rejectOptional = () => {
    setConsent({ analytics: false, marketing: false });
  };

  return (
    <>
      {bannerOpen ? (
        <aside className="consent-banner" aria-label="Cookie preferences" role="dialog" aria-live="polite">
          <p className="consent-banner__title">Cookie preferences</p>
          <p className="consent-banner__body">
            We use optional cookies for analytics and marketing. You can change these settings any time.
            See our{' '}
            <Link href="/privacy" className="consent-banner__link">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="consent-banner__options">
            <label className="consent-banner__option">
              <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
              <span>Analytics cookies</span>
            </label>
            <label className="consent-banner__option">
              <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />
              <span>Marketing cookies</span>
            </label>
          </div>
          <div className="consent-banner__actions">
            <button type="button" className="consent-btn consent-btn--ghost" onClick={rejectOptional}>
              Essential only
            </button>
            <button type="button" className="consent-btn consent-btn--ghost" onClick={savePreferences}>
              Save choices
            </button>
            <button type="button" className="consent-btn consent-btn--solid" onClick={acceptAll}>
              Accept all
            </button>
            {hasStoredChoice ? (
              <button type="button" className="consent-btn consent-btn--text" onClick={closeBanner}>
                Close
              </button>
            ) : null}
          </div>
        </aside>
      ) : hasStoredChoice ? (
        <button type="button" className="consent-settings-button" onClick={openBanner}>
          Cookie settings
        </button>
      ) : null}
    </>
  );
}
