'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type FooterVisibilityGateProps = {
  children: ReactNode;
};

export default function FooterVisibilityGate({ children }: FooterVisibilityGateProps) {
  const pathname = usePathname();

  if (
    pathname === '/projects' ||
    pathname === '/staff' ||
    pathname.startsWith('/staff/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/pricebook' ||
    pathname.startsWith('/pricebook/')
  ) {
    return null;
  }

  return <>{children}</>;
}
