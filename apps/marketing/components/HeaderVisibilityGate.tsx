'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { shouldHideMarketingHeader } from './marketingRouteChrome';

type HeaderVisibilityGateProps = {
  children: ReactNode;
};

export default function HeaderVisibilityGate({ children }: HeaderVisibilityGateProps) {
  const pathname = usePathname();

  if (shouldHideMarketingHeader(pathname)) return null;

  return <>{children}</>;
}
