'use client';

import { createContext, useContext } from 'react';
import type { PortalInstantRoute } from '@/lib/portalInstantRoutes';

export type PortalRouteTransitionInput = {
  href: string;
  label?: string;
  source?: string;
  control?: HTMLElement | null;
};

export type PortalRouteTransitionContextValue = {
  beginRouteTransition: (input: PortalRouteTransitionInput) => void;
  beginInstantRoute: (route: PortalInstantRoute, options?: { label?: string | null; href?: string }) => void;
  finishInstantRoute: (route: PortalInstantRoute) => void;
  instantRoute: PortalInstantRoute | null;
  instantRouteLabel: string | null;
  pendingHref: string | null;
  pathname: string | null;
  routeKey: string;
};

export const PortalRouteTransitionContext = createContext<PortalRouteTransitionContextValue>({
  beginRouteTransition: () => {},
  beginInstantRoute: () => {},
  finishInstantRoute: () => {},
  instantRoute: null,
  instantRouteLabel: null,
  pendingHref: null,
  pathname: null,
  routeKey: '',
});

export function usePortalRouteTransition(): PortalRouteTransitionContextValue {
  return useContext(PortalRouteTransitionContext);
}

type RouteTransitionClickEvent = {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  currentTarget?: EventTarget | null;
};

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
