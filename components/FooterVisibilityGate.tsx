'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type FooterVisibilityGateProps = {
  children: ReactNode;
};

export default function FooterVisibilityGate({ children }: FooterVisibilityGateProps) {
  const pathname = usePathname();

  if (pathname === '/projects') {
    return null;
  }

  return <>{children}</>;
}

