'use client';

import Link, { type LinkProps } from 'next/link';
import type { ComponentProps } from 'react';
import {
  shouldHandleRouteTransitionClick,
  shouldStartRouteTransitionForHref,
  usePortalRouteTransition,
} from '@/components/page-state/PortalRouteTransition';
import { portalInstantRouteTarget } from '@/lib/portalInstantRoutes';

type PortalRouteLinkProps = ComponentProps<typeof Link> & {
  href: LinkProps['href'];
};

/**
 * Next's Link prevents the native click after its own onClick has accepted the
 * navigation. Starting the portal transition here lets a consumer cancel first
 * while still distinguishing that successful Next interception from a veto.
 */
export default function PortalRouteLink({ href, onClick, ...props }: PortalRouteLinkProps) {
  const { beginRouteTransition } = usePortalRouteTransition();
  const hrefString = typeof href === 'string' ? href : null;

  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented
          || !hrefString
          || !shouldHandleRouteTransitionClick(event)
          || !shouldStartRouteTransitionForHref(hrefString)
        ) return;

        beginRouteTransition({
          href: hrefString,
          label: event.currentTarget.getAttribute('aria-label')
            || event.currentTarget.textContent?.trim()
            || undefined,
          source: 'portal-route-link',
          control: event.currentTarget,
        });

        if (
          typeof navigator !== 'undefined'
          && navigator.onLine === false
          && portalInstantRouteTarget(hrefString, window.location.href)
        ) {
          event.preventDefault();
        }
      }}
    />
  );
}
