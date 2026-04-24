'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import SidebarRail from '@/components/navigation/SidebarRail';
import SidebarRevealOverlayLab from '@/components/navigation/SidebarRevealOverlayLab';
import { SIDEBAR_WIDTH_PX } from '@/components/navigation/navItems';
import styles from './PortalShell.module.css';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { buildAccessStatusHref, buildLoginHref, currentRequestPathWithSearch, toAccessStatusQueryState } from '@/lib/portalAccess';
import { PortalRouteTransitionProvider } from '@/components/page-state/PortalRouteTransition';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function isPublicRoutePath(pathname: string | null): boolean {
  return Boolean(pathname && (pathname.startsWith('/login') || pathname.startsWith('/access-status')));
}

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status, email, role } = usePortalSession();
  const hasMountedRef = useRef(false);

  const isPublicRoute = isPublicRoutePath(pathname);
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
  const callbackUrl = useMemo(() => {
    const url = new URL('http://portal.local');
    url.pathname = pathname || '/dashboard';
    const search = searchParams.toString();
    url.search = search ? `?${search}` : '';
    return currentRequestPathWithSearch(url);
  }, [pathname, searchParams]);
  const redirectHref = useMemo(() => {
    if (status === 'unauthenticated') return buildLoginHref(callbackUrl);
    if (status === 'no_access' || status === 'lookup_failed') {
      return buildAccessStatusHref({
        state: toAccessStatusQueryState(status),
        callbackUrl,
      });
    }
    return null;
  }, [callbackUrl, status]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (isPublicRoute || !redirectHref) return;
    router.replace(redirectHref);
  }, [isPublicRoute, redirectHref, router]);

  if (isPublicRoute) return <>{children}</>;

  if (status !== 'authenticated' || !role) {
    return <div className={styles.contentStandalone}>{children}</div>;
  }

  return (
    <PortalRouteTransitionProvider>
      <div className={cx(styles.shell, isViewportLockedPath && styles.shellViewportLocked)}>
        <SidebarRail email={email ?? undefined} roleLabel={roleLabel} role={role ?? undefined} />
        <SidebarRevealOverlayLab />
        <div className={cx(styles.content, isViewportLockedPath && styles.contentViewportLocked)} style={{ paddingLeft: SIDEBAR_WIDTH_PX }}>
          {children}
        </div>
      </div>
    </PortalRouteTransitionProvider>
  );
}
