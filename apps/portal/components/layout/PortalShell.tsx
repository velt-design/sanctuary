'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
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
  usePortalRouteTransition,
} from '@/components/page-state/PortalRouteTransition';
import PortalCurrentRouteFrame from '@/components/page-state/PortalCurrentRouteFrame';
import { replacePortalDocument } from '@/lib/portalDocumentNavigation';

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
    pathname === '/qa/commercial-workflow-fixture' ||
    pathname === '/qa/project-page-shell-fixture' ||
    pathname === '/qa/ui-foundation-fixture' ||
    pathname === '/qa/email-preview-workbench-fixture' ||
    pathname === '/qa/design-booklet-workbench-fixture' ||
    pathname === '/qa/project-work-queue-fixture' ||
    pathname === '/qa/schedule-ops-fixture'
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
  return Boolean(pathname && /^\/(?:staff\/)?projects\/[^/]+\/design-workbench(?:\/|$)/.test(pathname));
}

function isAuthenticatedStandaloneRoutePath(pathname: string | null): boolean {
  return Boolean(
    pathname &&
      (pathname === '/staff/design-booklets' ||
        pathname.startsWith('/staff/design-booklets/') ||
        pathname === '/design-booklets' ||
        pathname.startsWith('/design-booklets/')),
  );
}

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status, email, role } = usePortalSession();
  const { instantRoute, pendingHref } = usePortalRouteTransition();
  const hasMountedRef = useRef(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const pendingPathname = useMemo(() => {
    if (!instantRoute || !pendingHref) return null;
    try {
      return new URL(pendingHref, 'http://portal.local').pathname;
    } catch {
      return null;
    }
  }, [instantRoute, pendingHref]);
  const shellPathname = pendingPathname ?? pathname;
  const isPublicRoute = isPublicRoutePath(pathname, searchParams);
  const sidebarMode = isDesignWorkbenchRoutePath(shellPathname) ? 'railOnly' : 'pinned';
  const isViewportLockedPath =
    typeof shellPathname === 'string' &&
    (shellPathname === '/schedule' ||
      shellPathname.startsWith('/schedule/') ||
      shellPathname === '/staff/schedule' ||
      shellPathname.startsWith('/staff/schedule/') ||
      shellPathname === '/staff/running-jobs' ||
      shellPathname.startsWith('/staff/running-jobs/') ||
      shellPathname === '/running-jobs' ||
      shellPathname.startsWith('/running-jobs/') ||
      shellPathname === '/staff/projects/running-jobs' ||
      shellPathname.startsWith('/staff/projects/running-jobs/') ||
      shellPathname === '/projects/running-jobs' ||
      shellPathname.startsWith('/projects/running-jobs/') ||
      shellPathname === '/staff/projects/design-packages' ||
      shellPathname.startsWith('/staff/projects/design-packages/') ||
      shellPathname === '/projects/design-packages' ||
      shellPathname.startsWith('/projects/design-packages/'));
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
    replacePortalDocument(redirectHref);
  }, [isPublicRoute, redirectHref]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname, shellPathname]);

  if (isPublicRoute) return <>{children}</>;

  const authenticated = status === 'authenticated' && Boolean(role);
  const booting = status === 'loading';

  if (!authenticated && !booting) {
    return (
      <div className={styles.contentStandalone} data-portal-shell-auth-state="locked">
        <PortalCurrentRouteFrame />
      </div>
    );
  }

  return (
      isAuthenticatedStandaloneRoutePath(shellPathname) ? (
        <div data-authenticated-standalone-shell>
          <PortalInstantRouteContent>
            {authenticated ? children : <PortalCurrentRouteFrame />}
          </PortalInstantRouteContent>
        </div>
      ) : (
        <div
          className={cx(styles.shell, isViewportLockedPath && styles.shellViewportLocked)}
          data-portal-sidebar-mode={sidebarMode}
          data-portal-viewport-mode={isViewportLockedPath ? 'locked' : 'document'}
          data-portal-shell-auth-state={booting ? 'booting' : 'authenticated'}
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
          <header className={styles.mobileTopBar} data-portal-mobile-top-bar>
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
            <PortalInstantRouteContent>
              {authenticated ? children : <PortalCurrentRouteFrame />}
            </PortalInstantRouteContent>
          </div>
        </div>
      )
  );
}
