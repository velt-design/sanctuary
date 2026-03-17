'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import SidebarRail from '@/components/navigation/SidebarRail';
import SidebarRevealOverlayLab from '@/components/navigation/SidebarRevealOverlayLab';
import { SIDEBAR_WIDTH_PX } from '@/components/navigation/navItems';
import styles from './PortalShell.module.css';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, email, role } = usePortalSession();

  const isLogin = typeof pathname === 'string' && pathname.startsWith('/login');
  const isViewportLockedPath =
    typeof pathname === 'string' &&
    (pathname === '/schedule' ||
      pathname.startsWith('/schedule/') ||
      pathname === '/staff/schedule' ||
      pathname.startsWith('/staff/schedule/') ||
      pathname === '/staff/running-jobs' ||
      pathname.startsWith('/staff/running-jobs/') ||
      pathname === '/staff/projects/running-jobs' ||
      pathname.startsWith('/staff/projects/running-jobs/') ||
      pathname === '/staff/projects/design-packages' ||
      pathname.startsWith('/staff/projects/design-packages/'));
  const roleLabel = role === 'admin' ? 'Admin access' : 'Staff access';

  useEffect(() => {
    if (isLogin) return;
    if (status === 'unauthenticated') router.replace('/login');
  }, [isLogin, router, status]);

  if (isLogin) return <>{children}</>;
  if (status !== 'authenticated') return null;

  return (
    <div className={cx(styles.shell, isViewportLockedPath && styles.shellViewportLocked)}>
      <SidebarRail email={email ?? undefined} roleLabel={roleLabel} role={role ?? undefined} />
      <SidebarRevealOverlayLab />
      <div className={cx(styles.content, isViewportLockedPath && styles.contentViewportLocked)} style={{ paddingLeft: SIDEBAR_WIDTH_PX }}>
        {children}
      </div>
    </div>
  );
}
