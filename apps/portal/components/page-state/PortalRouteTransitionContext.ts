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
