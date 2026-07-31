"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  CONSENT_STORAGE_KEY,
  CONSENT_UPDATED_EVENT,
  createDefaultConsent,
  createRegionalDefaultConsent,
  createStoredConsent,
  parseStoredConsent,
  serializeConsent,
  toGtagConsentMode,
  type ConsentPreferences,
  type ConsentUpdate,
} from '@/lib/consent';
import {
  TRACKING_REGION_SESSION_KEY,
  parseTrackingRegionPolicy,
  type TrackingBasis,
  type TrackingRegionPolicy,
} from '@/lib/trackingRegion';

type ConsentEventDetail = {
  consent: ConsentPreferences;
  hasStoredChoice: boolean;
  trackingBasis: TrackingBasis;
  trackingRegionPolicy: TrackingRegionPolicy | null;
};

type ConsentContextValue = {
  consent: ConsentPreferences;
  hasStoredChoice: boolean;
  hasTrackingDecision: boolean;
  trackingBasis: TrackingBasis;
  trackingRegionPolicy: TrackingRegionPolicy | null;
  bannerOpen: boolean;
  setConsent: (update: ConsentUpdate) => void;
  openBanner: () => void;
  closeBanner: () => void;
};

type GtagFn = (...args: unknown[]) => void;

function ensureGtag(): GtagFn {
  const w = window as typeof window & { dataLayer?: unknown[]; gtag?: GtagFn };
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== 'function') {
    w.gtag = function gtagShim() {
      w.dataLayer!.push(arguments);
    } as GtagFn;
  }
  return w.gtag;
}

function applyConsentModeDefault(consent: ConsentUpdate) {
  const gtag = ensureGtag();
  gtag('consent', 'default', {
    ...toGtagConsentMode(consent),
    wait_for_update: 500,
  });
}

function applyConsentModeUpdate(consent: ConsentUpdate) {
  const gtag = ensureGtag();
  gtag('consent', 'update', toGtagConsentMode(consent));
}

function dispatchConsentEvent(detail: ConsentEventDetail) {
  window.dispatchEvent(
    new CustomEvent<ConsentEventDetail>(CONSENT_UPDATED_EVENT, {
      detail,
    })
  );
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsentState] = useState<ConsentPreferences>(() => createDefaultConsent());
  const [hasStoredChoice, setHasStoredChoice] = useState(false);
  const [trackingBasis, setTrackingBasis] = useState<TrackingBasis>('none');
  const [trackingRegionPolicy, setTrackingRegionPolicy] = useState<TrackingRegionPolicy | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const explicitChoiceMadeRef = useRef(false);

  useEffect(() => {
    const defaultConsent = createDefaultConsent();
    applyConsentModeDefault(defaultConsent);
    let cancelled = false;

    let storedConsent: ConsentPreferences | null = null;
    try {
      storedConsent = parseStoredConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
    } catch {
      storedConsent = null;
    }

    if (storedConsent) {
      setConsentState(storedConsent);
      setHasStoredChoice(true);
      setTrackingBasis('user_choice');
      setBannerOpen(false);
      setInitialized(true);
      return () => {
        cancelled = true;
      };
    }

    const initializeRegionalPolicy = async () => {
      let policy: TrackingRegionPolicy | null = null;
      try {
        policy = parseTrackingRegionPolicy(
          sessionStorage.getItem(TRACKING_REGION_SESSION_KEY),
        );
      } catch {
        policy = null;
      }

      if (!policy) {
        try {
          const response = await fetch('/api/tracking-region', {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          });
          const payload = response.ok
            ? await response.json() as { policy?: unknown }
            : null;
          policy = parseTrackingRegionPolicy(payload?.policy);
        } catch {
          policy = null;
        }
      }

      const resolvedPolicy = policy ?? 'consent_required';
      try {
        sessionStorage.setItem(TRACKING_REGION_SESSION_KEY, resolvedPolicy);
      } catch {
        // A storage failure only means the small region check repeats next visit.
      }

      if (cancelled || explicitChoiceMadeRef.current) return;
      setTrackingRegionPolicy(resolvedPolicy);
      setHasStoredChoice(false);

      if (resolvedPolicy === 'nz_automatic') {
        setConsentState(createRegionalDefaultConsent());
        setTrackingBasis('regional_default');
        setBannerOpen(false);
      } else {
        setConsentState(defaultConsent);
        setTrackingBasis('none');
        setBannerOpen(true);
      }
      setInitialized(true);
    };

    void initializeRegionalPolicy();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

    applyConsentModeUpdate(consent);
    dispatchConsentEvent({
      consent,
      hasStoredChoice,
      trackingBasis,
      trackingRegionPolicy,
    });
  }, [
    consent,
    hasStoredChoice,
    initialized,
    trackingBasis,
    trackingRegionPolicy,
  ]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CONSENT_STORAGE_KEY) return;
      const next = parseStoredConsent(event.newValue);
      if (!next) return;
      setConsentState(next);
      setHasStoredChoice(true);
      setTrackingBasis('user_choice');
      setBannerOpen(false);
      setInitialized(true);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setConsent = useCallback((update: ConsentUpdate) => {
    explicitChoiceMadeRef.current = true;
    const next = createStoredConsent(update);
    setConsentState(next);
    setHasStoredChoice(true);
    setTrackingBasis('user_choice');
    setBannerOpen(false);
    setInitialized(true);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, serializeConsent(next));
    } catch {
      // Ignore storage failures; consent still applies in-memory for this session.
    }
  }, []);

  const openBanner = useCallback(() => setBannerOpen(true), []);
  const closeBanner = useCallback(() => setBannerOpen(false), []);
  const hasTrackingDecision = trackingBasis !== 'none';

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      hasStoredChoice,
      hasTrackingDecision,
      trackingBasis,
      trackingRegionPolicy,
      bannerOpen,
      setConsent,
      openBanner,
      closeBanner,
    }),
    [
      bannerOpen,
      closeBanner,
      consent,
      hasStoredChoice,
      hasTrackingDecision,
      openBanner,
      setConsent,
      trackingBasis,
      trackingRegionPolicy,
    ]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
}
