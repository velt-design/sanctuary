'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import SidebarRail from '@/components/navigation/SidebarRail';
import { SIDEBAR_WIDTH_PX } from '@/components/navigation/navItems';
import styles from './PortalShell.module.css';

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, status } = useSession();

  const isLogin = typeof pathname === 'string' && pathname.startsWith('/login');
  const email = typeof data?.user?.email === 'string' ? data.user.email : undefined;

  useEffect(() => {
    if (isLogin) return;
    if (status === 'unauthenticated') router.replace('/login');
  }, [isLogin, router, status]);

  if (isLogin) return <>{children}</>;
  if (status !== 'authenticated') return null;

  return (
    <div className={styles.shell}>
      <SidebarRail email={email} roleLabel="Admin access" />
      <div className={styles.content} style={{ paddingLeft: SIDEBAR_WIDTH_PX }}>
        {children}
      </div>
    </div>
  );
}
