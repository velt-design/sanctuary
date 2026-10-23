'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import SidebarRail from '@/components/navigation/SidebarRail';
import PortalSidebarPanel from '@/components/navigation/PortalSidebarPanel';
import { SIDEBAR_PINNED_WIDTH_PX, SIDEBAR_RAIL_WIDTH_PX } from '@/components/navigation/sidebarLayout';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { Drawer } from '@/components/ui/drawer/Drawer';
import { PortalInstantRouteContent, PortalRouteTransitionProvider } from '@/components/page-state/PortalRouteTransition';
import { GlobalPortalSearchStateProvider } from './GlobalPortalSearchState';
import styles from './PortalShell.module.css';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
function isDesignWorkbenchRoutePath(pathname: string | null): boolean {
  return Boolean(pathname && /^\/staff\/projects\/[^/]+\/design-workbench(?:\/|$)/.test(pathname));
}

/** Keep navigation state with its owning shell, including standalone/public visits. */
export function usePortalFrameNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const shellRouteKey = `${pathname ?? ''}?${searchParams.toString()}`;
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [shellRouteKey]);
  return { isSidebarCollapsed, setIsSidebarCollapsed, isMobileNavOpen, setIsMobileNavOpen };
}

/** Shared presentation only. PortalShell owns production access and redirects. */
export default function PortalFrame({ children, financeAccess = false, navigation }: { children: React.ReactNode; financeAccess?: boolean; navigation: ReturnType<typeof usePortalFrameNavigation> }) {
  const pathname = usePathname();
  const { email, role } = usePortalSession();
  const { isSidebarCollapsed, setIsSidebarCollapsed, isMobileNavOpen, setIsMobileNavOpen } = navigation;
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
  const sidebarLayoutStyle = useMemo(
    () =>
      ({
        '--portal-sidebar-rail-width': `${SIDEBAR_RAIL_WIDTH_PX}px`,
        '--portal-sidebar-pinned-width': `${SIDEBAR_PINNED_WIDTH_PX}px`,
      }) as CSSProperties,
    [],
  );

  return (
    <PortalRouteTransitionProvider>
      <GlobalPortalSearchStateProvider>
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
            financeAccess={financeAccess}
          />
        ) : (
          <PortalSidebarPanel financeAccess={financeAccess} />
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
        <header className={styles.mobileTopBar} data-portal-mobile-top-bar>
          <strong>Sanctuary</strong>
          <button type="button" aria-label="Open portal navigation" aria-expanded={isMobileNavOpen} onClick={() => setIsMobileNavOpen(true)}>
            <Menu aria-hidden="true" />
          </button>
        </header>
        <Drawer open={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} title="Portal navigation" side="left">
          <PortalSidebarPanel mode="drawer" financeAccess={financeAccess} />
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
      </GlobalPortalSearchStateProvider>
    </PortalRouteTransitionProvider>
  );
}
