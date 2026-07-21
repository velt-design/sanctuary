'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { ButtonLink, type ButtonVariant, type ControlSize } from '@/components/ui/foundation/FoundationControls';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { shouldHandleRouteTransitionClick } from '@/components/page-state/PortalRouteTransition';
import { openPortalIndexInstantly, portalIndexTarget, preloadPortalIndex } from '@/lib/queries/portalIndexNavigation';

type PortalIndexLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
  variant?: ButtonVariant;
  size?: ControlSize;
};

export default function PortalIndexLink({
  href,
  onClick,
  onFocus,
  onMouseEnter,
  onPointerDown,
  onTouchStart,
  prefetch = false,
  variant,
  size,
  ...props
}: PortalIndexLinkProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { beginInstantRoute } = usePortalRouteTransition();
  const prepare = () => preloadPortalIndex(queryClient, router, href);

  const linkProps = {
    ...props,
    href,
    prefetch,
    onClick: (event: Parameters<NonNullable<ComponentProps<typeof Link>['onClick']>>[0]) => {
        onClick?.(event);
        if (event.defaultPrevented || !shouldHandleRouteTransitionClick(event)) return;
        const target = portalIndexTarget(href);
        if (!target) return;
        beginInstantRoute(target.route);
        openPortalIndexInstantly(event, router, href);
      },
    onFocus: (event: Parameters<NonNullable<ComponentProps<typeof Link>['onFocus']>>[0]) => { onFocus?.(event); if (!event.defaultPrevented) prepare(); },
    onMouseEnter: (event: Parameters<NonNullable<ComponentProps<typeof Link>['onMouseEnter']>>[0]) => { onMouseEnter?.(event); if (!event.defaultPrevented) prepare(); },
    onPointerDown: (event: Parameters<NonNullable<ComponentProps<typeof Link>['onPointerDown']>>[0]) => { onPointerDown?.(event); if (!event.defaultPrevented) prepare(); },
    onTouchStart: (event: Parameters<NonNullable<ComponentProps<typeof Link>['onTouchStart']>>[0]) => { onTouchStart?.(event); if (!event.defaultPrevented) prepare(); },
  };

  if (variant) return <ButtonLink {...linkProps} variant={variant} size={size} />;
  return <Link {...linkProps} />;
}
