'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const SHOW_DELAY_MS = 150;
const TRICKLE_INTERVAL_MS = 180;
const COMPLETE_VISIBLE_MS = 220;
const RESET_DELAY_MS = 280;
const FAILSAFE_RESET_MS = 8000;

type ProgressPhase = 'idle' | 'loading' | 'complete';

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function isIgnoredPath(pathname: string) {
  return pathname.startsWith('/staff') || pathname.startsWith('/admin');
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reducedMotion;
}

export default function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => `${pathname ?? ''}?${searchParams.toString()}`, [pathname, searchParams]);
  const reducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<ProgressPhase>('idle');
  const [progress, setProgress] = useState(0);

  const mountedRef = useRef(false);
  const loadingRef = useRef(false);
  const phaseRef = useRef<ProgressPhase>('idle');
  const showTimerRef = useRef<number | null>(null);
  const trickleTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const failsafeTimerRef = useRef<number | null>(null);

  const clearTimer = useCallback((timerRef: MutableRefObject<number | null>) => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const clearTrickle = useCallback(() => {
    if (trickleTimerRef.current === null) return;
    window.clearInterval(trickleTimerRef.current);
    trickleTimerRef.current = null;
  }, []);

  const clearAllTimers = useCallback(() => {
    clearTimer(showTimerRef);
    clearTimer(completeTimerRef);
    clearTimer(resetTimerRef);
    clearTimer(failsafeTimerRef);
    clearTrickle();
  }, [clearTimer, clearTrickle]);

  const setProgressPhase = useCallback((nextPhase: ProgressPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const resetProgress = useCallback(() => {
    clearAllTimers();
    loadingRef.current = false;
    setProgressPhase('idle');
    setProgress(0);
  }, [clearAllTimers, setProgressPhase]);

  const startProgress = useCallback(() => {
    clearAllTimers();
    loadingRef.current = true;
    setProgressPhase('idle');
    setProgress(0);

    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = null;
      if (!loadingRef.current) return;

      setProgressPhase('loading');
      setProgress(reducedMotion ? 0.78 : 0.12);

      if (reducedMotion) return;

      trickleTimerRef.current = window.setInterval(() => {
        setProgress((current) => {
          if (current >= 0.86) return current;
          return current + (0.88 - current) * 0.16;
        });
      }, TRICKLE_INTERVAL_MS);
    }, SHOW_DELAY_MS);

    failsafeTimerRef.current = window.setTimeout(() => {
      resetProgress();
      failsafeTimerRef.current = null;
    }, FAILSAFE_RESET_MS);
  }, [clearAllTimers, reducedMotion, resetProgress, setProgressPhase]);

  const completeProgress = useCallback(() => {
    if (!loadingRef.current && phaseRef.current === 'idle') return;

    loadingRef.current = false;
    clearTimer(showTimerRef);
    clearTrickle();

    if (phaseRef.current === 'idle') {
      setProgress(0);
      return;
    }

    setProgressPhase('complete');
    setProgress(1);

    completeTimerRef.current = window.setTimeout(() => {
      setProgressPhase('idle');
      resetTimerRef.current = window.setTimeout(() => {
        setProgress(0);
        resetTimerRef.current = null;
      }, RESET_DELAY_MS);
      completeTimerRef.current = null;
    }, reducedMotion ? 0 : COMPLETE_VISIBLE_MS);
  }, [clearTimer, clearTrickle, reducedMotion, setProgressPhase]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || isModifiedClick(event)) return;

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;

      try {
        const url = new URL(rawHref, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (isIgnoredPath(url.pathname)) return;

        const currentPathAndSearch = `${window.location.pathname}${window.location.search}`;
        const nextPathAndSearch = `${url.pathname}${url.search}`;
        if (nextPathAndSearch === currentPathAndSearch) return;

        startProgress();
      } catch {
        resetProgress();
      }
    };

    const onPopState = () => {
      if (isIgnoredPath(window.location.pathname)) return;
      startProgress();
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
      clearAllTimers();
    };
  }, [clearAllTimers, resetProgress, startProgress]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    completeProgress();
  }, [completeProgress, routeKey]);

  return (
    <div
      className={`route-progress route-progress--${phase}`}
      aria-hidden="true"
      style={{ transform: `scaleX(${progress})` }}
    />
  );
}
