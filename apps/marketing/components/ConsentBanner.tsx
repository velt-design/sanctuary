"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useConsent } from '@/components/ConsentProvider';

export default function ConsentBanner() {
  const { consent, hasStoredChoice, bannerOpen, setConsent, closeBanner } = useConsent();
  const [analytics, setAnalytics] = useState(consent.analytics);
  const [marketing, setMarketing] = useState(consent.marketing);
  const [showChoices, setShowChoices] = useState(false);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setAnalytics(consent.analytics);
    setMarketing(consent.marketing);
  }, [consent.analytics, consent.marketing]);

  useEffect(() => {
    if (!bannerOpen) {
      setShowChoices(false);
    }
  }, [bannerOpen]);

  useEffect(() => {
    if (bannerOpen) {
      if (!hasStoredChoice) return undefined;

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement
        && activeElement !== document.body
        && !activeElement.closest('.consent-banner')
      ) {
        openerRef.current = activeElement;
        const focusFrame = window.requestAnimationFrame(() => {
          firstActionRef.current?.focus();
        });
        return () => window.cancelAnimationFrame(focusFrame);
      }

      return undefined;
    }

    const opener = openerRef.current;
    openerRef.current = null;
    if (!opener) return undefined;

    const restoreFrame = window.requestAnimationFrame(() => {
      if (document.contains(opener)) opener.focus();
    });
    return () => window.cancelAnimationFrame(restoreFrame);
  }, [bannerOpen, hasStoredChoice]);

  const savePreferences = () => {
    setConsent({ analytics, marketing });
  };

  const acceptAll = () => {
    setConsent({ analytics: true, marketing: true });
  };

  const rejectOptional = () => {
    setConsent({ analytics: false, marketing: false });
  };

  if (!bannerOpen) return null;

  return (
    <aside className="consent-banner" aria-label="Cookie preferences" role="region" aria-live="polite">
      <div className="consent-banner__row">
        <p className="consent-banner__body">
          We use optional cookies for analytics and marketing. See our{' '}
          <Link href="/privacy" className="consent-banner__link">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="consent-banner__actions">
          <button
            ref={firstActionRef}
            type="button"
            className="consent-btn consent-btn--ghost"
            onClick={rejectOptional}
          >
            Essential only
          </button>
          <button type="button" className="consent-btn consent-btn--solid" onClick={acceptAll}>
            Accept all
          </button>
          <button
            type="button"
            className="consent-btn consent-btn--text"
            onClick={() => setShowChoices((open) => !open)}
            aria-controls="consent-preference-choices"
            aria-expanded={showChoices}
          >
            {showChoices ? 'Hide choices' : 'Manage choices'}
          </button>
          {hasStoredChoice ? (
            <button type="button" className="consent-btn consent-btn--text" onClick={closeBanner}>
              Close
            </button>
          ) : null}
        </div>
      </div>
      {showChoices ? (
        <div id="consent-preference-choices" className="consent-banner__options">
          <label className="consent-banner__option">
            <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
            <span>Analytics cookies</span>
          </label>
          <label className="consent-banner__option">
            <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />
            <span>Marketing cookies</span>
          </label>
          <button type="button" className="consent-btn consent-btn--ghost" onClick={savePreferences}>
            Save choices
          </button>
        </div>
      ) : null}
    </aside>
  );
}
