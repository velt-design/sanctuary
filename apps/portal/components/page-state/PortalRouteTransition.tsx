'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams, useSelectedLayoutSegments } from 'next/navigation';
import { PortalPageSourceProvider, usePortalPageSourceController } from './PortalPageSource';
import PortalActualFrames from './PortalActualFrames';
import { PortalRouteTransitionContext, shouldStartRouteTransitionForHref, type PortalRouteTransitionInput } from './PortalRouteTransitionContext';
export { shouldHandleRouteTransitionClick, shouldStartRouteTransitionForHref, usePortalRouteTransition } from './PortalRouteTransitionContext';
import PortalNavigationProgress from './PortalNavigationProgress';
import { retainPortalHistory } from './portalHistoryGuard';
import {
  portalInstantRouteReleasesOnCommit,
  portalInstantRouteTarget,
  type PortalInstantRoute,
} from '@/lib/portalInstantRoutes';

export type { PortalInstantRoute } from '@/lib/portalInstantRoutes';

const MAX_TRANSITION_MS = 8000;
const DEFAULT_MESSAGE = 'Preparing workspace...';
const MAX_INSTANT_ROUTE_MS = 8000;

function routeKeyFor(pathname: string | null, searchParams: { toString(): string }): string {
  return `${pathname ?? ''}?${searchParams.toString()}`;
}

export function PortalRouteTransitionProvider({ children }: { children: ReactNode }) {
  useEffect(retainPortalHistory, []);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segments = useSelectedLayoutSegments();
  const canonicalPath = `/${segments.filter(segment => !segment.startsWith('(') && segment !== '__PAGE__').join('/')}`;
  const pageSource = usePortalPageSourceController(pathname, canonicalPath, searchParams.toString());
  const beginPageSource = pageSource.begin;
  const cancelPageSource = pageSource.cancel;
  const routeKey = useMemo(() => routeKeyFor(pathname, searchParams), [pathname, searchParams]);
  const previousRouteKeyRef = useRef<string | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const instantRouteTimerRef = useRef<number | null>(null);
  const instantRouteRef = useRef<PortalInstantRoute | null>(null);
  const busyControlRef = useRef<{ element: HTMLElement; previousAriaBusy: string | null } | null>(null);
  const activeRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [ariaLabel, setAriaLabel] = useState(DEFAULT_MESSAGE);
  const [instantRoute, setInstantRoute] = useState<PortalInstantRoute | null>(null);
  const [instantRouteLabel, setInstantRouteLabel] = useState<string | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const clearTimer = useCallback((timerRef: { current: number | null }) => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const clearBusyControl = useCallback(() => {
    const busyControl = busyControlRef.current;
    busyControlRef.current = null;
    if (!busyControl) return;

    delete busyControl.element.dataset.portalRoutePending;
    if (busyControl.previousAriaBusy === null) {
      busyControl.element.removeAttribute('aria-busy');
    } else {
      busyControl.element.setAttribute('aria-busy', busyControl.previousAriaBusy);
    }
  }, []);

  const markBusyControl = useCallback(
    (control: HTMLElement | null | undefined) => {
      clearBusyControl();
      if (!control) return;
      busyControlRef.current = {
        element: control,
        previousAriaBusy: control.getAttribute('aria-busy'),
      };
      control.dataset.portalRoutePending = 'true';
      control.setAttribute('aria-busy', 'true');
    },
    [clearBusyControl],
  );

  const finishRouteTransition = useCallback(() => {
    activeRef.current = false;
    clearTimer(maxTimerRef);
    clearBusyControl();
    setPendingHref(null);
    setVisible(false);
  }, [clearBusyControl, clearTimer]);

  const finishInstantRoute = useCallback(
    (route: PortalInstantRoute) => {
      if (instantRouteRef.current !== route) return;
      instantRouteRef.current = null;
      setInstantRoute(null);
      setInstantRouteLabel(null);
      clearTimer(instantRouteTimerRef);
    },
    [clearTimer],
  );

  const beginInstantRoute = useCallback(
    (route: PortalInstantRoute, options?: { label?: string | null; href?: string }) => {
      if (options?.href && new URL(options.href, window.location.href).pathname !== window.location.pathname) {
        beginPageSource(options.href);
      }
      clearTimer(instantRouteTimerRef);
      instantRouteRef.current = route;
      setInstantRoute(route);
      setInstantRouteLabel(options?.label?.trim() || null);
      instantRouteTimerRef.current = window.setTimeout(() => {
        if (instantRouteRef.current !== route) return;
        instantRouteTimerRef.current = null;
        instantRouteRef.current = null;
        setInstantRoute(null);
        setInstantRouteLabel(null);
      }, MAX_INSTANT_ROUTE_MS);
    },
    [beginPageSource, clearTimer],
  );

  const beginRouteTransition = useCallback(
    (input: PortalRouteTransitionInput) => {
      if (typeof window === 'undefined') return;
      if (!shouldStartRouteTransitionForHref(input.href)) return;

      const target = portalInstantRouteTarget(input.href, window.location.href);
      if (target && target.url.pathname !== window.location.pathname) {
        beginInstantRoute(target.route, { label: input.label, href: input.href });
      }

      activeRef.current = true;
      setPendingHref(input.href);
      setAriaLabel(input.label ? `Preparing ${input.label}` : DEFAULT_MESSAGE);
      clearTimer(maxTimerRef);
      markBusyControl(input.control);
      setVisible(true);

      maxTimerRef.current = window.setTimeout(() => {
        maxTimerRef.current = null;
        finishRouteTransition();
      }, MAX_TRANSITION_MS);
    },
    [beginInstantRoute, clearTimer, finishRouteTransition, markBusyControl],
  );

  useEffect(() => {
    const previousRouteKey = previousRouteKeyRef.current;
    previousRouteKeyRef.current = routeKey;
    if (!previousRouteKey || previousRouteKey === routeKey) return;
    if (instantRoute && portalInstantRouteReleasesOnCommit(instantRoute)) {
      finishInstantRoute(instantRoute);
    }
    if (!activeRef.current) return;
    finishRouteTransition();
  }, [finishInstantRoute, finishRouteTransition, instantRoute, routeKey]);

  useEffect(
    () => () => {
      clearTimer(maxTimerRef);
      clearTimer(instantRouteTimerRef);
      clearBusyControl();
    },
    [clearBusyControl, clearTimer],
  );

  useEffect(() => {
    const handlePopState = () => {
      cancelPageSource();
      clearTimer(instantRouteTimerRef);
      instantRouteRef.current = null;
      setInstantRoute(null);
      setInstantRouteLabel(null);
      finishRouteTransition();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [cancelPageSource, clearTimer, finishRouteTransition]);

  const value = useMemo(
    () => ({
      beginRouteTransition,
      beginInstantRoute,
      finishInstantRoute,
      instantRoute,
      instantRouteLabel,
      pendingHref,
      pathname,
      routeKey,
    }),
    [
      beginInstantRoute,
      beginRouteTransition,
      finishInstantRoute,
      instantRoute,
      instantRouteLabel,
      pendingHref,
      pathname,
      routeKey,
    ],
  );

  return (
    <PortalRouteTransitionContext.Provider value={value}>
      <PortalPageSourceProvider value={pageSource}>
      {children}
      {visible ? <PortalNavigationProgress ariaLabel={ariaLabel} /> : null}
      </PortalPageSourceProvider>
    </PortalRouteTransitionContext.Provider>
  );
}

/** One real frame sits beside Next's retained outlet; private children are source-gated. */
export function PortalInstantRouteContent({ children }: { children: ReactNode }) {
  return <div style={{display:'contents'}} data-portal-route-content="true">
    <PortalActualFrames>{children}</PortalActualFrames>
  </div>;
}
