'use client';

import { useEffect } from 'react';
import {
  discoverLoadedPortalStaticAssets,
  normalizePortalStaticCacheVersion,
  registerPortalStaticCacheWorker,
  waitForPortalStaticCacheWorkerVersion,
  warmPortalStaticCache,
} from '@/lib/offline/portalStaticCache';
import { preloadPortalCoreShellCode } from '@/lib/offline/portalCoreShellPreload';

const MAX_SETUP_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1_000, 5_000] as const;

type PortalStaticCacheRuntimeProps = {
  version: string;
  assets?: readonly string[];
  enabled?: boolean;
  onUpdateReady?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
};

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Portal static-cache setup failed.');
}

function reportRuntimeState(state: 'error' | 'ready' | 'warming', error?: Error): void {
  document.documentElement.dataset.portalOfflineShellState = state;
  window.dispatchEvent(new CustomEvent('portal-static-cache-state', {
    detail: { state, error: error?.message ?? null },
  }));
}

export default function PortalStaticCacheRuntime({
  version,
  assets,
  enabled = true,
  onUpdateReady,
  onError,
}: PortalStaticCacheRuntimeProps) {
  useEffect(() => {
    if (!enabled || !normalizePortalStaticCacheVersion(version)) return;

    let active = true;
    let registration: ServiceWorkerRegistration | null = null;
    let installingWorker: ServiceWorker | null = null;
    let attemptCount = 0;
    let attemptRunning = false;
    let ready = false;
    let retryTimer: number | null = null;

    const reportWaitingWorker = () => {
      if (active && registration?.waiting) onUpdateReady?.(registration);
    };
    const handleInstallingState = () => {
      if (installingWorker?.state === 'installed') reportWaitingWorker();
    };
    const handleUpdateFound = () => {
      installingWorker?.removeEventListener('statechange', handleInstallingState);
      installingWorker = registration?.installing ?? null;
      installingWorker?.addEventListener('statechange', handleInstallingState);
    };

    const clearRetry = () => {
      if (retryTimer === null) return;
      window.clearTimeout(retryTimer);
      retryTimer = null;
    };

    const attachRegistration = (next: ServiceWorkerRegistration) => {
      if (registration === next) return;
      registration?.removeEventListener('updatefound', handleUpdateFound);
      installingWorker?.removeEventListener('statechange', handleInstallingState);
      registration = next;
      registration.addEventListener('updatefound', handleUpdateFound);
      handleUpdateFound();
      reportWaitingWorker();
    };

    const runSetup = async () => {
      if (!active || ready || attemptRunning || attemptCount >= MAX_SETUP_ATTEMPTS) return;
      clearRetry();
      attemptRunning = true;
      attemptCount += 1;
      reportRuntimeState('warming');
      try {
        const nextRegistration = await registerPortalStaticCacheWorker(version);
        if (!active) return;
        if (!nextRegistration) throw new Error('Portal static-cache worker is unavailable.');
        attachRegistration(nextRegistration);

        await waitForPortalStaticCacheWorkerVersion(nextRegistration, version);
        if (!active) return;
        const preload = await preloadPortalCoreShellCode();
        if (preload.failed.length > 0) {
          throw new Error(`Portal shell preload failed (${preload.failed.join(', ')}).`);
        }
        if (!active) return;
        const warmAssets = assets ?? discoverLoadedPortalStaticAssets();
        const result = await warmPortalStaticCache(nextRegistration, { version, urls: warmAssets });
        if (!result.ok) throw new Error(`Portal static-cache warm failed (${result.error ?? 'unknown'}).`);
        ready = true;
        reportRuntimeState('ready');
      } catch (error) {
        if (!active) return;
        const setupError = toError(error);
        reportRuntimeState('error', setupError);
        onError?.(setupError);
        if (attemptCount < MAX_SETUP_ATTEMPTS && navigator.onLine !== false) {
          const delay = RETRY_DELAYS_MS[Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1)];
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            void runSetup();
          }, delay);
        }
      } finally {
        attemptRunning = false;
      }
    };

    const retryNow = () => {
      if (!active || ready || attemptRunning || attemptCount >= MAX_SETUP_ATTEMPTS) return;
      clearRetry();
      void runSetup();
    };

    window.addEventListener('online', retryNow);
    window.addEventListener('focus', retryNow);
    void runSetup();

    return () => {
      active = false;
      clearRetry();
      window.removeEventListener('online', retryNow);
      window.removeEventListener('focus', retryNow);
      registration?.removeEventListener('updatefound', handleUpdateFound);
      installingWorker?.removeEventListener('statechange', handleInstallingState);
    };
  }, [assets, enabled, onError, onUpdateReady, version]);

  return null;
}
