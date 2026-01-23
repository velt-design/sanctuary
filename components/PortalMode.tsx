'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function isPortalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === '/login' ||
    pathname === '/staff' ||
    pathname.startsWith('/staff/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  );
}

export default function PortalMode() {
  const pathname = usePathname();

  useEffect(() => {
    const enabled = isPortalPath(pathname);
    document.documentElement.classList.toggle('portal-mode', enabled);
    document.body.classList.toggle('portal-mode', enabled);
    return () => {
      document.documentElement.classList.remove('portal-mode');
      document.body.classList.remove('portal-mode');
    };
  }, [pathname]);

  return null;
}
