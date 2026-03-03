"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CONSENT_STORAGE_KEY,
  CONSENT_UPDATED_EVENT,
  createDefaultConsent,
  createStoredConsent,
  parseStoredConsent,
  serializeConsent,
  toGtagConsentMode,
  type ConsentPreferences,
  type ConsentUpdate,
} from '@/lib/consent';

type ConsentEventDetail = {
  consent: ConsentPreferences;
  hasStoredChoice: boolean;
};

type ConsentContextValue = {
  consent: ConsentPreferences;
  hasStoredChoice: boolean;
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
  const [bannerOpen, setBannerOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const defaultConsent = createDefaultConsent();
    applyConsentModeDefault(defaultConsent);

    let storedConsent: ConsentPreferences | null = null;
    try {
      storedConsent = parseStoredConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
    } catch {
      storedConsent = null;
    }

    if (storedConsent) {
      setConsentState(storedConsent);
      setHasStoredChoice(true);
      setBannerOpen(false);
    } else {
      setConsentState(defaultConsent);
      setHasStoredChoice(false);
      setBannerOpen(true);
    }

    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;

    applyConsentModeUpdate(consent);
    dispatchConsentEvent({ consent, hasStoredChoice });
  }, [consent, hasStoredChoice, initialized]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CONSENT_STORAGE_KEY) return;
      const next = parseStoredConsent(event.newValue);
      if (!next) return;
      setConsentState(next);
      setHasStoredChoice(true);
      setBannerOpen(false);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setConsent = useCallback((update: ConsentUpdate) => {
    const next = createStoredConsent(update);
    setConsentState(next);
    setHasStoredChoice(true);
    setBannerOpen(false);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, serializeConsent(next));
    } catch {
      // Ignore storage failures; consent still applies in-memory for this session.
    }
  }, []);

  const openBanner = useCallback(() => setBannerOpen(true), []);
  const closeBanner = useCallback(() => setBannerOpen(false), []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      hasStoredChoice,
      bannerOpen,
      setConsent,
      openBanner,
      closeBanner,
    }),
    [bannerOpen, consent, hasStoredChoice, openBanner, closeBanner, setConsent]
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
