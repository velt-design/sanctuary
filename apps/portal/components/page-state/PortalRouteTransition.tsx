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
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import PortalNavigationProgress from './PortalNavigationProgress';
import PortalInstantRouteFrame from './PortalInstantRouteFrame';
import styles from './PortalRouteTransition.module.css';
import {
  PORTAL_INSTANT_ROUTE_DEFINITIONS,
  portalInstantRouteReleasesOnCommit,
  portalInstantRouteTarget,
  type PortalInstantRoute,
  type PortalInstantRouteTarget,
} from '@/lib/portalInstantRoutes';
import { dispatchPortalNavigationIntent } from '@/lib/portalNavigationIntent';

export type { PortalInstantRoute } from '@/lib/portalInstantRoutes';

const MAX_TRANSITION_MS = 8000;
const DEFAULT_MESSAGE = 'Preparing workspace...';
const MAX_INSTANT_ROUTE_MS = 8000;

type PortalRouteTransitionInput = {
  href: string;
  label?: string;
  source?: string;
  control?: HTMLElement | null;
};

type PortalRouteTransitionContextValue = {
  beginRouteTransition: (input: PortalRouteTransitionInput) => void;
  navigateRoute: (
    input: PortalRouteTransitionInput,
    options?: { replace?: boolean; scroll?: boolean },
  ) => boolean;
  beginInstantRoute: (route: PortalInstantRoute, options?: { label?: string | null }) => void;
  finishInstantRoute: (route: PortalInstantRoute) => void;
  connectionOnline: boolean;
  offlineShellActive: boolean;
  instantRoute: PortalInstantRoute | null;
  instantRouteLabel: string | null;
  pendingHref: string | null;
  pathname: string | null;
  routeKey: string;
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
  navigateRoute: () => false,
  beginInstantRoute: () => {},
  finishInstantRoute: () => {},
  connectionOnline: true,
  offlineShellActive: false,
  instantRoute: null,
  instantRouteLabel: null,
  pendingHref: null,
  pathname: null,
  routeKey: '',
});

function routeKeyFor(pathname: string | null, searchParams: { toString(): string }): string {
  return `${pathname ?? ''}?${searchParams.toString()}`;
}

function currentUrlFromLocation(location: Location | URL): URL {
  return location instanceof URL ? location : new URL(location.href);
}

function relativeHref(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

function anchorFromClickTarget(target: EventTarget | null): HTMLAnchorElement | null {
  if (target instanceof HTMLAnchorElement) return target;
  if (target instanceof Element) return target.closest<HTMLAnchorElement>('a[href]');
  if (target instanceof Node) return target.parentElement?.closest<HTMLAnchorElement>('a[href]') ?? null;
  return null;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => routeKeyFor(pathname, searchParams), [pathname, searchParams]);
  const previousRouteKeyRef = useRef<string | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const instantRouteTimerRef = useRef<number | null>(null);
  const busyControlRef = useRef<{ element: HTMLElement; previousAriaBusy: string | null } | null>(null);
  const activeRef = useRef(false);
  const offlineShellActiveRef = useRef(false);
  const instantRouteRef = useRef<PortalInstantRoute | null>(null);
  const [visible, setVisible] = useState(false);
  const [ariaLabel, setAriaLabel] = useState(DEFAULT_MESSAGE);
  const [connectionOnline, setConnectionOnline] = useState(true);
  const [offlineShellActive, setOfflineShellActive] = useState(false);
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

  const leaveOfflineShell = useCallback(() => {
    offlineShellActiveRef.current = false;
    setOfflineShellActive(false);
  }, []);

  const showOfflineRoute = useCallback(
    (
      target: PortalInstantRouteTarget,
      options?: { label?: string | null; updateHistory?: boolean },
    ) => {
      activeRef.current = false;
      offlineShellActiveRef.current = true;
      clearTimer(maxTimerRef);
      clearTimer(instantRouteTimerRef);
      clearBusyControl();
      setVisible(false);
      setConnectionOnline(false);
      setOfflineShellActive(true);
      setPendingHref(relativeHref(target.url));
      instantRouteRef.current = target.route;
      setInstantRoute(target.route);
      setInstantRouteLabel(options?.label?.trim() || target.definition.title);

      if (options?.updateHistory !== false) {
        // Do not copy Next's private __NA history marker. Its patched
        // pushState deliberately ignores entries carrying that marker, which
        // would leave usePathname/useSearchParams and the portal chrome stuck
        // on the route we just replaced with an offline frame.
        window.history.pushState({}, '', relativeHref(target.url));
      }
    },
    [clearBusyControl, clearTimer],
  );

  const finishRouteTransition = useCallback((options?: { preservePendingHref?: boolean }) => {
    activeRef.current = false;
    clearTimer(maxTimerRef);
    clearBusyControl();
    if (!options?.preservePendingHref) setPendingHref(null);
    setVisible(false);
  }, [clearBusyControl, clearTimer]);

  const finishInstantRoute = useCallback(
    (route: PortalInstantRoute) => {
      if (offlineShellActiveRef.current) return;
      if (instantRouteRef.current !== route) return;
      instantRouteRef.current = null;
      setInstantRoute(null);
      setInstantRouteLabel(null);
      setPendingHref(null);
      clearTimer(instantRouteTimerRef);
    },
    [clearTimer],
  );

  const beginInstantRoute = useCallback(
    (route: PortalInstantRoute, options?: { label?: string | null }) => {
      if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
        leaveOfflineShell();
      }
      clearTimer(instantRouteTimerRef);
      instantRouteRef.current = route;
      setInstantRoute(route);
      setInstantRouteLabel(options?.label?.trim() || null);
      instantRouteTimerRef.current = window.setTimeout(() => {
        instantRouteTimerRef.current = null;
        // A stalled/failed RSC request must not expose the previous route or a
        // generic loading page. Keep the data-free final frame mounted until
        // the destination commits or another explicit navigation replaces it.
      }, MAX_INSTANT_ROUTE_MS);
    },
    [clearTimer, leaveOfflineShell],
  );

  const beginRouteTransition = useCallback(
    (input: PortalRouteTransitionInput) => {
      if (typeof window === 'undefined') return;
      if (!shouldStartRouteTransitionForHref(input.href)) return;

      const target = portalInstantRouteTarget(input.href, window.location.href);
      if (target && navigator.onLine === false) {
        showOfflineRoute(target, { label: input.label });
        return;
      }

      leaveOfflineShell();
      setConnectionOnline(true);
      if (target && target.url.pathname !== window.location.pathname) {
        beginInstantRoute(target.route, { label: input.label });
      }

      activeRef.current = true;
      setPendingHref(input.href);
      setAriaLabel(input.label ? `Preparing ${input.label}` : DEFAULT_MESSAGE);
      clearTimer(maxTimerRef);
      markBusyControl(input.control);
      setVisible(true);

      maxTimerRef.current = window.setTimeout(() => {
        maxTimerRef.current = null;
        finishRouteTransition({ preservePendingHref: Boolean(target) });
      }, MAX_TRANSITION_MS);
    },
    [
      beginInstantRoute,
      clearTimer,
      finishRouteTransition,
      leaveOfflineShell,
      markBusyControl,
      showOfflineRoute,
    ],
  );

  const navigateRoute = useCallback(
    (
      input: PortalRouteTransitionInput,
      options?: { replace?: boolean; scroll?: boolean },
    ): boolean => {
      if (typeof window !== 'undefined' && !dispatchPortalNavigationIntent({
        href: input.href,
        source: input.source ?? 'programmatic',
      })) return false;
      beginRouteTransition(input);
      const target = typeof window === 'undefined'
        ? null
        : portalInstantRouteTarget(input.href, window.location.href);
      if (target && navigator.onLine === false) return false;
      const navigationOptions = options?.scroll === undefined
        ? undefined
        : { scroll: options.scroll };
      if (options?.replace) router.replace(input.href, navigationOptions);
      else router.push(input.href, navigationOptions);
      return true;
    },
    [beginRouteTransition, router],
  );

  useEffect(() => {
    const previousRouteKey = previousRouteKeyRef.current;
    previousRouteKeyRef.current = routeKey;
    if (!previousRouteKey || previousRouteKey === routeKey) return;
    if (offlineShellActiveRef.current) return;
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
    const handleOnline = () => setConnectionOnline(true);
    const handleOffline = () => setConnectionOnline(false);
    setConnectionOnline(navigator.onLine !== false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const portalLinkForEvent = (event: MouseEvent) => {
      if (!shouldHandleRouteTransitionClick(event)) return;
      const anchor = anchorFromClickTarget(event.target);
      if (
        !anchor
        || anchor.hasAttribute('download')
        || anchor.getAttribute('aria-disabled') === 'true'
      ) return;
      const href = anchor.getAttribute('href');
      if (!href || !shouldStartRouteTransitionForHref(href)) return;
      const target = portalInstantRouteTarget(href, window.location.href);
      if (!target) return;

      return { anchor, href, target };
    };

    // Capture owns only the synchronous unsaved-work veto. Actual presentation
    // waits until consumer onClick handlers have had the chance to cancel.
    const handlePortalLinkIntent = (event: MouseEvent) => {
      const link = portalLinkForEvent(event);
      if (!link) return;

      const allowed = dispatchPortalNavigationIntent(
        { href: link.href, source: 'portal-link' },
        event,
      );
      if (!allowed) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
    };

    // Plain anchors have no link-owned transition hook. Handle them after
    // bubbling so React preventDefault() cancellation is authoritative.
    const handlePlainPortalLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const link = portalLinkForEvent(event);
      if (!link) return;
      const label = link.anchor.getAttribute('aria-label') || link.anchor.textContent;
      if (navigator.onLine === false) {
        event.preventDefault();
        showOfflineRoute(link.target, { label });
        return;
      }

      beginRouteTransition({
        href: link.href,
        label: label?.trim() || undefined,
        source: 'portal-link',
        control: link.anchor,
      });
    };

    document.addEventListener('click', handlePortalLinkIntent, true);
    document.addEventListener('click', handlePlainPortalLinkClick);
    return () => {
      document.removeEventListener('click', handlePortalLinkIntent, true);
      document.removeEventListener('click', handlePlainPortalLinkClick);
    };
  }, [beginRouteTransition, showOfflineRoute]);

  useEffect(() => {
    const handlePopState = () => {
      if (navigator.onLine === false) {
        const target = portalInstantRouteTarget(window.location.href, window.location.href);
        if (target) {
          showOfflineRoute(target, { updateHistory: false });
          return;
        }
      }

      leaveOfflineShell();
      clearTimer(instantRouteTimerRef);
      setPendingHref(null);
      instantRouteRef.current = null;
      setInstantRoute(null);
      setInstantRouteLabel(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [clearTimer, leaveOfflineShell, showOfflineRoute]);

  const value = useMemo(
    () => ({
      beginRouteTransition,
      navigateRoute,
      beginInstantRoute,
      finishInstantRoute,
      connectionOnline,
      offlineShellActive,
      instantRoute,
      instantRouteLabel,
      pendingHref,
      pathname,
      routeKey,
    }),
    [
      beginInstantRoute,
      beginRouteTransition,
      connectionOnline,
      finishInstantRoute,
      instantRoute,
      instantRouteLabel,
      navigateRoute,
      offlineShellActive,
      pendingHref,
      pathname,
      routeKey,
    ],
  );

  return (
    <PortalRouteTransitionContext.Provider value={value}>
      {children}
      {visible ? <PortalNavigationProgress ariaLabel={ariaLabel} /> : null}
    </PortalRouteTransitionContext.Provider>
  );
}

export function PortalInstantRouteContent({ children }: { children: ReactNode }) {
  const {
    connectionOnline,
    instantRoute,
    instantRouteLabel,
    offlineShellActive,
    pathname,
    pendingHref,
  } = usePortalRouteTransition();
  const routeFocusTargetRef = useRef<HTMLDivElement | null>(null);
  const transientFrameOwnedFocusRef = useRef(false);
  const instantDefinition = instantRoute
    ? PORTAL_INSTANT_ROUTE_DEFINITIONS[instantRoute]
    : null;
  const recoveryHref = offlineShellActive && typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
    : pendingHref ?? pathname ?? '/dashboard';

  useEffect(() => {
    if (instantRoute) {
      const target = routeFocusTargetRef.current;
      target?.focus({ preventScroll: true });
      transientFrameOwnedFocusRef.current = document.activeElement === target;
      const handleFocusIn = (event: FocusEvent) => {
        transientFrameOwnedFocusRef.current = Boolean(
          target && event.target instanceof Node && target.contains(event.target),
        );
      };
      document.addEventListener('focusin', handleFocusIn);
      return () => document.removeEventListener('focusin', handleFocusIn);
    }

    if (!transientFrameOwnedFocusRef.current) return;
    transientFrameOwnedFocusRef.current = false;
    const committedTarget = document.querySelector<HTMLElement>(
      '[data-portal-route-content] [data-portal-page-shell-ready="true"], '
      + '[data-portal-route-content] main, '
      + '[data-portal-route-content] [role="main"], '
      + '[data-portal-route-content] h1',
    );
    if (!committedTarget) return;
    const previousTabIndex = committedTarget.getAttribute('tabindex');
    committedTarget.setAttribute('tabindex', '-1');
    committedTarget.focus({ preventScroll: true });
    if (previousTabIndex === null) committedTarget.removeAttribute('tabindex');
    else committedTarget.setAttribute('tabindex', previousTabIndex);
  }, [instantRoute, pendingHref]);

  return (
    <div
      className={styles.routeHost}
      data-portal-shell-host="true"
      data-portal-shell-host-route={instantRoute ?? undefined}
    >
      {offlineShellActive ? (
        <div
          className={styles.offlineNotice}
          data-portal-offline-shell-state={connectionOnline ? 'reconnected' : 'offline'}
          role="status"
          aria-live="polite"
        >
          <span>
            {connectionOnline
              ? 'Connection restored. Reload when you are ready for live data.'
              : 'Offline. Page structure is available; live data and actions are paused.'}
          </span>
          {connectionOnline ? <a href={recoveryHref}>Reload live data</a> : null}
        </div>
      ) : null}
      {instantRoute && instantDefinition ? (
        <div
          ref={routeFocusTargetRef}
          className={styles.focusTarget}
          tabIndex={-1}
          role="region"
          aria-label={`${instantDefinition.title} page`}
          data-portal-route-focus-target="true"
        >
          <PortalInstantRouteFrame
            offlineShellActive={offlineShellActive}
            route={instantRoute}
            label={instantRouteLabel}
            targetHref={pendingHref}
          />
        </div>
      ) : null}
      <div
        style={{ display: instantRoute ? 'none' : 'contents' }}
        aria-hidden={instantRoute ? 'true' : undefined}
        data-portal-route-content="true"
      >
        {offlineShellActive ? null : children}
      </div>
    </div>
  );
}
