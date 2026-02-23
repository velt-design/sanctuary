'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type HeaderVisibilityGateProps = {
  children: ReactNode;
};

function shouldHideHeader(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === '/quote' ||
    pathname.startsWith('/quote/') ||
    pathname === '/start/explore' ||
    pathname.startsWith('/start/explore/') ||
    pathname === '/staff' ||
    pathname.startsWith('/staff/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/pricebook' ||
    pathname.startsWith('/pricebook/')
  );
}

export default function HeaderVisibilityGate({ children }: HeaderVisibilityGateProps) {
  const pathname = usePathname();

  if (shouldHideHeader(pathname)) return null;

  return <>{children}</>;
}
