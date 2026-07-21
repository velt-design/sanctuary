'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import SidebarRail from '@/components/navigation/SidebarRail';
import PortalSidebarPanel from '@/components/navigation/PortalSidebarPanel';
import {
  SIDEBAR_PINNED_WIDTH_PX,
  SIDEBAR_RAIL_WIDTH_PX,
} from '@/components/navigation/sidebarLayout';
import styles from './PortalShell.module.css';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { buildAccessStatusHref, buildLoginHref, currentRequestPathWithSearch, toAccessStatusQueryState } from '@/lib/portalAccess';
import { Drawer } from '@/components/ui/drawer/Drawer';
import {
  PortalInstantRouteContent,
  PortalRouteTransitionProvider,
} from '@/components/page-state/PortalRouteTransition';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function isFixtureWorkbenchRoutePath(
  pathname: string | null,
  searchParams: { get(name: string): string | null } | null,
): boolean {
  if (!pathname) return false;
  if (pathname === '/qa/design-workbench-fixture' || pathname.startsWith('/qa/design-workbench-fixture/')) {
    return true;
  }
  return pathname === '/staff/projects/fixture-roof/design-workbench' && Boolean(searchParams?.get('fixture')?.trim());
}

function isPortalQaFixtureRoutePath(
  pathname: string | null,
  searchParams: { get(name: string): string | null } | null,
): boolean {
  return (
    isFixtureWorkbenchRoutePath(pathname, searchParams) ||
    pathname === '/qa/projects-index-mutation-fixture' ||
    pathname === '/qa/project-command-centre-fixture' ||
    pathname === '/qa/project-page-shell-fixture' ||
    pathname === '/qa/ui-foundation-fixture'
  );
}

function isPublicRoutePath(pathname: string | null, searchParams: { get(name: string): string | null } | null): boolean {
  return Boolean(
    pathname &&
      (pathname.startsWith('/login') ||
        pathname.startsWith('/access-status') ||
        isPortalQaFixtureRoutePath(pathname, searchParams)),
  );
}

function isDesignWorkbenchRoutePath(pathname: string | null): boolean {
  return Boolean(pathname && /^\/staff\/projects\/[^/]+\/design-workbench(?:\/|$)/.test(pathname));
}

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status, email, role } = usePortalSession();
  const hasMountedRef = useRef(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const isPublicRoute = isPublicRoutePath(pathname, searchParams);
  const sidebarMode = isDesignWorkbenchRoutePath(pathname) ? 'railOnly' : 'pinned';
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
  const sidebarLayoutStyle = useMemo(
    () =>
      ({
        '--portal-sidebar-rail-width': `${SIDEBAR_RAIL_WIDTH_PX}px`,
        '--portal-sidebar-pinned-width': `${SIDEBAR_PINNED_WIDTH_PX}px`,
      }) as CSSProperties,
    [],
  );

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (isPublicRoute || !redirectHref) return;
    router.replace(redirectHref);
  }, [isPublicRoute, redirectHref, router]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  if (isPublicRoute) return <>{children}</>;

  if (status !== 'authenticated' || !role) {
    return <div className={styles.contentStandalone}>{children}</div>;
  }

  return (
    <PortalRouteTransitionProvider>
      <div
        className={cx(styles.shell, isViewportLockedPath && styles.shellViewportLocked)}
        data-portal-sidebar-mode={sidebarMode}
        style={sidebarLayoutStyle}
      >
        {sidebarMode === 'railOnly' || isSidebarCollapsed ? (
          <SidebarRail
            email={email ?? undefined}
            roleLabel={roleLabel}
            role={role ?? undefined}
            panelVisible={false}
          />
        ) : (
          <PortalSidebarPanel />
        )}
        {sidebarMode === 'pinned' ? (
          <button
            type="button"
            className={styles.sidebarToggle}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={isSidebarCollapsed}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            {isSidebarCollapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
          </button>
        ) : null}
        <header className={styles.mobileTopBar}>
          <strong>Sanctuary</strong>
          <button type="button" aria-label="Open portal navigation" aria-expanded={isMobileNavOpen} onClick={() => setIsMobileNavOpen(true)}>
            <Menu aria-hidden="true" />
          </button>
        </header>
        <Drawer open={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} title="Portal navigation" side="left">
          <PortalSidebarPanel mode="drawer" />
        </Drawer>
        <div
          className={cx(
            styles.content,
            sidebarMode === 'pinned' && !isSidebarCollapsed && styles.contentSidebarPinned,
            isViewportLockedPath && styles.contentViewportLocked,
          )}
          data-portal-content-sidebar-mode={sidebarMode === 'pinned' && isSidebarCollapsed ? 'collapsed' : sidebarMode}
        >
          <PortalInstantRouteContent>{children}</PortalInstantRouteContent>
        </div>
      </div>
    </PortalRouteTransitionProvider>
  );
}
