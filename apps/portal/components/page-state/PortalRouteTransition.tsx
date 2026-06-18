'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import BlueprintLoadingScreen from './BlueprintLoadingScreen';

const SHOW_DELAY_MS = 160;
const MIN_VISIBLE_MS = 450;
const MAX_TRANSITION_MS = 8000;
const DEFAULT_MESSAGE = 'Preparing workspace...';

type PortalRouteTransitionInput = {
  href: string;
  label?: string;
  source?: string;
  show?: 'delayed' | 'immediate';
};

type PortalRouteTransitionContextValue = {
  beginRouteTransition: (input: PortalRouteTransitionInput) => void;
};

type RouteTransitionClickEvent = {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  currentTarget?: EventTarget | null;
};

const PortalRouteTransitionContext = createContext<PortalRouteTransitionContextValue>({
  beginRouteTransition: () => {},
});

function routeKeyFor(pathname: string | null, searchParams: { toString(): string }): string {
  return `${pathname ?? ''}?${searchParams.toString()}`;
}

function currentUrlFromLocation(location: Location | URL): URL {
  return location instanceof URL ? location : new URL(location.href);
}

export function shouldStartRouteTransitionForHref(
  href: string,
  location?: Location | URL,
): boolean {
  if (!href || href.startsWith('#')) return false;
  if (!location && typeof window === 'undefined') return false;

  let nextUrl: URL;
  let currentUrl: URL;

  try {
    currentUrl = currentUrlFromLocation(location ?? window.location);
    nextUrl = new URL(href, currentUrl.href);
  } catch {
    return false;
  }

  if (nextUrl.origin !== currentUrl.origin) return false;

  return nextUrl.pathname !== currentUrl.pathname || nextUrl.search !== currentUrl.search;
}

export function shouldHandleRouteTransitionClick(
  event: RouteTransitionClickEvent,
  anchor?: HTMLAnchorElement | null,
): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return false;

  const target =
    anchor ?? (event.currentTarget instanceof HTMLAnchorElement ? event.currentTarget : null);
  const linkTarget = target?.getAttribute('target');

  return !linkTarget || linkTarget === '_self';
}

export function usePortalRouteTransition(): PortalRouteTransitionContextValue {
  return useContext(PortalRouteTransitionContext);
}

export function PortalRouteTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => routeKeyFor(pathname, searchParams), [pathname, searchParams]);
  const previousRouteKeyRef = useRef<string | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const visibleAtRef = useRef(0);
  const activeRef = useRef(false);
  const visibleRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [ariaLabel, setAriaLabel] = useState(DEFAULT_MESSAGE);

  const clearTimer = useCallback((timerRef: { current: number | null }) => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const setVisibleValue = useCallback((next: boolean) => {
    visibleRef.current = next;
    setVisible(next);
  }, []);

  const hideNow = useCallback(() => {
    clearTimer(hideTimerRef);
    setVisibleValue(false);
  }, [clearTimer, setVisibleValue]);

  const finishRouteTransition = useCallback(
    ({ force = false }: { force?: boolean } = {}) => {
      activeRef.current = false;
      clearTimer(showTimerRef);
      clearTimer(maxTimerRef);

      if (!visibleRef.current) {
        hideNow();
        return;
      }

      if (force) {
        hideNow();
        return;
      }

      const elapsedMs = window.performance.now() - visibleAtRef.current;
      const remainingMs = Math.max(MIN_VISIBLE_MS - elapsedMs, 0);
      if (remainingMs === 0) {
        hideNow();
        return;
      }

      clearTimer(hideTimerRef);
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null;
        hideNow();
      }, remainingMs);
    },
    [clearTimer, hideNow],
  );

  const beginRouteTransition = useCallback(
    (input: PortalRouteTransitionInput) => {
      if (typeof window === 'undefined') return;
      if (!shouldStartRouteTransitionForHref(input.href)) return;
      const showMode = input.show ?? 'delayed';

      activeRef.current = true;
      setAriaLabel(input.label ? `Preparing ${input.label}` : DEFAULT_MESSAGE);
      clearTimer(showTimerRef);
      clearTimer(hideTimerRef);
      clearTimer(maxTimerRef);

      maxTimerRef.current = window.setTimeout(() => {
        maxTimerRef.current = null;
        finishRouteTransition({ force: true });
      }, MAX_TRANSITION_MS);

      if (showMode === 'immediate') {
        visibleAtRef.current = window.performance.now();
        if (!visibleRef.current) setVisibleValue(true);
        return;
      }

      if (visibleRef.current) return;

      showTimerRef.current = window.setTimeout(() => {
        showTimerRef.current = null;
        if (!activeRef.current) return;
        visibleAtRef.current = window.performance.now();
        setVisibleValue(true);
      }, SHOW_DELAY_MS);
    },
    [clearTimer, finishRouteTransition, setVisibleValue],
  );

  useEffect(() => {
    const previousRouteKey = previousRouteKeyRef.current;
    previousRouteKeyRef.current = routeKey;
    if (!previousRouteKey || previousRouteKey === routeKey) return;
    if (!activeRef.current && !visibleRef.current) return;
    finishRouteTransition();
  }, [finishRouteTransition, routeKey]);

  useEffect(
    () => () => {
      clearTimer(showTimerRef);
      clearTimer(hideTimerRef);
      clearTimer(maxTimerRef);
    },
    [clearTimer],
  );

  const value = useMemo(
    () => ({
      beginRouteTransition,
    }),
    [beginRouteTransition],
  );

  return (
    <PortalRouteTransitionContext.Provider value={value}>
      {children}
      {visible ? (
        <BlueprintLoadingScreen variant="overlay" message={DEFAULT_MESSAGE} ariaLabel={ariaLabel} />
      ) : null}
    </PortalRouteTransitionContext.Provider>
  );
}
