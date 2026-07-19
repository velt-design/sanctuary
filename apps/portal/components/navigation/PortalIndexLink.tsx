'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { shouldHandleRouteTransitionClick } from '@/components/page-state/PortalRouteTransition';
import { openPortalIndexInstantly, portalIndexTarget, preloadPortalIndex } from '@/lib/queries/portalIndexNavigation';

type PortalIndexLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

export default function PortalIndexLink({
  href,
  onClick,
  onFocus,
  onMouseEnter,
  onPointerDown,
  onTouchStart,
  prefetch = false,
  ...props
}: PortalIndexLinkProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { beginInstantRoute } = usePortalRouteTransition();
  const prepare = () => preloadPortalIndex(queryClient, router, href);

  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !shouldHandleRouteTransitionClick(event)) return;
        const target = portalIndexTarget(href);
        if (!target) return;
        beginInstantRoute(target.route);
        openPortalIndexInstantly(event, router, href);
      }}
      onFocus={(event) => { onFocus?.(event); if (!event.defaultPrevented) prepare(); }}
      onMouseEnter={(event) => { onMouseEnter?.(event); if (!event.defaultPrevented) prepare(); }}
      onPointerDown={(event) => { onPointerDown?.(event); if (!event.defaultPrevented) prepare(); }}
      onTouchStart={(event) => { onTouchStart?.(event); if (!event.defaultPrevented) prepare(); }}
    />
  );
}
