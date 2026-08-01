'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { shouldHideMarketingFooter } from './marketingRouteChrome';

type FooterVisibilityGateProps = {
  children: ReactNode;
};

export default function FooterVisibilityGate({ children }: FooterVisibilityGateProps) {
  const pathname = usePathname();

  if (shouldHideMarketingFooter(pathname)) {
    return null;
  }

  return <>{children}</>;
}
