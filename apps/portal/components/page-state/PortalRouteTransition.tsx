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
import PortalNavigationProgress from './PortalNavigationProgress';
import ProjectsIndexPendingFrame from './ProjectsIndexPendingFrame';
import ContactsIndexPendingFrame from './ContactsIndexPendingFrame';

const MAX_TRANSITION_MS = 8000;
const DEFAULT_MESSAGE = 'Preparing workspace...';
const MAX_INSTANT_ROUTE_MS = 8000;

export type PortalInstantRoute = 'projects-index' | 'contacts-index';

type PortalRouteTransitionInput = {
  href: string;
  label?: string;
  source?: string;
  control?: HTMLElement | null;
};

type PortalRouteTransitionContextValue = {
  beginRouteTransition: (input: PortalRouteTransitionInput) => void;
  beginInstantRoute: (route: PortalInstantRoute) => void;
  finishInstantRoute: (route: PortalInstantRoute) => void;
  instantRoute: PortalInstantRoute | null;
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
  beginInstantRoute: () => {},
  finishInstantRoute: () => {},
  instantRoute: null,
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
  const maxTimerRef = useRef<number | null>(null);
  const instantRouteTimerRef = useRef<number | null>(null);
  const busyControlRef = useRef<{ element: HTMLElement; previousAriaBusy: string | null } | null>(null);
  const activeRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [ariaLabel, setAriaLabel] = useState(DEFAULT_MESSAGE);
  const [instantRoute, setInstantRoute] = useState<PortalInstantRoute | null>(null);

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
    setVisible(false);
  }, [clearBusyControl, clearTimer]);

  const beginRouteTransition = useCallback(
    (input: PortalRouteTransitionInput) => {
      if (typeof window === 'undefined') return;
      if (!shouldStartRouteTransitionForHref(input.href)) return;

      activeRef.current = true;
      setAriaLabel(input.label ? `Preparing ${input.label}` : DEFAULT_MESSAGE);
      clearTimer(maxTimerRef);
      markBusyControl(input.control);
      setVisible(true);

      maxTimerRef.current = window.setTimeout(() => {
        maxTimerRef.current = null;
        finishRouteTransition();
      }, MAX_TRANSITION_MS);
    },
    [clearTimer, finishRouteTransition, markBusyControl],
  );

  const finishInstantRoute = useCallback(
    (route: PortalInstantRoute) => {
      setInstantRoute((current) => (current === route ? null : current));
      clearTimer(instantRouteTimerRef);
    },
    [clearTimer],
  );

  const beginInstantRoute = useCallback(
    (route: PortalInstantRoute) => {
      clearTimer(instantRouteTimerRef);
      setInstantRoute(route);
      instantRouteTimerRef.current = window.setTimeout(() => {
        instantRouteTimerRef.current = null;
        setInstantRoute((current) => (current === route ? null : current));
      }, MAX_INSTANT_ROUTE_MS);
    },
    [clearTimer],
  );

  useEffect(() => {
    const previousRouteKey = previousRouteKeyRef.current;
    previousRouteKeyRef.current = routeKey;
    if (!previousRouteKey || previousRouteKey === routeKey) return;
    if (!activeRef.current) return;
    finishRouteTransition();
  }, [finishRouteTransition, routeKey]);

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
      clearTimer(instantRouteTimerRef);
      setInstantRoute(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [clearTimer]);

  const value = useMemo(
    () => ({
      beginRouteTransition,
      beginInstantRoute,
      finishInstantRoute,
      instantRoute,
    }),
    [beginInstantRoute, beginRouteTransition, finishInstantRoute, instantRoute],
  );

  return (
    <PortalRouteTransitionContext.Provider value={value}>
      {children}
      {visible ? <PortalNavigationProgress ariaLabel={ariaLabel} /> : null}
    </PortalRouteTransitionContext.Provider>
  );
}

export function PortalInstantRouteContent({ children }: { children: ReactNode }) {
  const { instantRoute } = usePortalRouteTransition();

  return (
    <>
      {instantRoute === 'projects-index' ? <ProjectsIndexPendingFrame /> : null}
      {instantRoute === 'contacts-index' ? <ContactsIndexPendingFrame /> : null}
      <div
        style={{ display: instantRoute ? 'none' : 'contents' }}
        aria-hidden={instantRoute ? 'true' : undefined}
        data-portal-route-content="true"
      >
        {children}
      </div>
    </>
  );
}
