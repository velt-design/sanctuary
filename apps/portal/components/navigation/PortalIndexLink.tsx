'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { ButtonLink, type ButtonVariant, type ControlSize } from '@/components/ui/foundation/FoundationControls';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { shouldHandleRouteTransitionClick, shouldStartRouteTransitionForHref } from '@/components/page-state/PortalRouteTransition';
import { openPortalIndexInstantly, openPortalActualFrameInstantly, portalIndexTarget, preloadPortalIndex } from '@/lib/queries/portalIndexNavigation';
import { publicFramePath } from '@/components/page-state/PortalPageSource';

type PortalIndexLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
  variant?: ButtonVariant;
  size?: ControlSize;
  disabled?: boolean;
};

export default function PortalIndexLink({
  href,
  onClick,
  onFocus,
  onMouseEnter,
  onPointerDown,
  onTouchStart,
  onNavigate,
  prefetch = false,
  variant,
  size,
  disabled = false,
  ...props
}: PortalIndexLinkProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { beginInstantRoute, beginRouteTransition } = usePortalRouteTransition();
  const prepare = () => {
    if (disabled || href.startsWith('#')) return;
    if ((props.target && props.target !== '_self') || (props.download != null && props.download !== false)) return;
    if (preloadPortalIndex(queryClient, router, href)) return;
    // Other destinations keep native navigation and warm only their route on
    // intent. They do not borrow index API reads or the instant index URL path.
    if (!shouldStartRouteTransitionForHref(href)) return;
    const path = new URL(href, window.location.href).pathname;
    if (!path.startsWith('/staff/') || /^\/staff\/(?:api|auth|login|logout)(?:\/|$)/.test(path)) return;
    router.prefetch(href);
  };

  const linkProps = {
    ...props,
    href,
    prefetch,
    onNavigate,
    onClick: (event: Parameters<NonNullable<ComponentProps<typeof Link>['onClick']>>[0]) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
        if (event.defaultPrevented || !shouldHandleRouteTransitionClick(event)) return;
        if (props.download != null && props.download !== false) return;
        const target = portalIndexTarget(href);
        const publicFrame = Boolean(publicFramePath(href, window.location.href))
          && shouldStartRouteTransitionForHref(href);
        if (target || publicFrame) {
          let cancelled = false;
          onNavigate?.({ preventDefault: () => { cancelled = true; } });
          if (cancelled) { event.preventDefault(); return; }
        }
        if (!target) {
          if (publicFrame) {
            beginRouteTransition({ href, source: 'dashboard-link', control: event.currentTarget });
            openPortalActualFrameInstantly(event, router, href);
          }
          return;
        }
        beginInstantRoute(target.route, { href });
        openPortalIndexInstantly(event, router, href);
      },
    onFocus: (event: Parameters<NonNullable<ComponentProps<typeof Link>['onFocus']>>[0]) => { onFocus?.(event); if (!event.defaultPrevented) prepare(); },
    onMouseEnter: (event: Parameters<NonNullable<ComponentProps<typeof Link>['onMouseEnter']>>[0]) => { onMouseEnter?.(event); if (!event.defaultPrevented) prepare(); },
    onPointerDown: (event: Parameters<NonNullable<ComponentProps<typeof Link>['onPointerDown']>>[0]) => { onPointerDown?.(event); if (!event.defaultPrevented) prepare(); },
    onTouchStart: (event: Parameters<NonNullable<ComponentProps<typeof Link>['onTouchStart']>>[0]) => { onTouchStart?.(event); if (!event.defaultPrevented) prepare(); },
  };

  if (variant) return <ButtonLink {...linkProps} variant={variant} size={size} disabled={disabled} />;
  return <Link {...linkProps} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : props.tabIndex} />;
}
