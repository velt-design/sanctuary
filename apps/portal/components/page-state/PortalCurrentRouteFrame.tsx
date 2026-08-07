'use client';

import { usePathname } from 'next/navigation';
import PortalInstantRouteFrame from './PortalInstantRouteFrame';
import { PortalUnregisteredRouteFrame } from './PortalRoutePendingFrame';
import { portalInstantRouteForPathname } from '@/lib/portalInstantRoutes';

export default function PortalCurrentRouteFrame() {
  const pathname = usePathname();
  const route = pathname ? portalInstantRouteForPathname(pathname) : null;
  if (!route) return <PortalUnregisteredRouteFrame />;
  return <PortalInstantRouteFrame route={route} />;
}
