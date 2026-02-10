'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import SidebarRail from '@/components/navigation/SidebarRail';
import { SIDEBAR_WIDTH_PX } from '@/components/navigation/navItems';
import styles from './PortalShell.module.css';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, email, role } = usePortalSession();

  const isLogin = typeof pathname === 'string' && pathname.startsWith('/login');
  const roleLabel = role === 'admin' ? 'Admin access' : 'Staff access';

  useEffect(() => {
    if (isLogin) return;
    if (status === 'unauthenticated') router.replace('/login');
  }, [isLogin, router, status]);

  if (isLogin) return <>{children}</>;
  if (status !== 'authenticated') return null;

  return (
    <div className={styles.shell}>
      <SidebarRail email={email ?? undefined} roleLabel={roleLabel} />
      <div className={styles.content} style={{ paddingLeft: SIDEBAR_WIDTH_PX }}>
        {children}
      </div>
    </div>
  );
}
