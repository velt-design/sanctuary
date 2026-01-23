'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type HeaderVisibilityGateProps = {
  children: ReactNode;
};

function shouldHideHeader(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/staff' || pathname.startsWith('/staff/') || pathname === '/admin' || pathname.startsWith('/admin/');
}

export default function HeaderVisibilityGate({ children }: HeaderVisibilityGateProps) {
  const pathname = usePathname();

  if (shouldHideHeader(pathname)) return null;

  return <>{children}</>;
}
