'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { NAV_ITEMS } from './navItems';
import UserMenu from './UserMenu';
import styles from './SidebarRail.module.css';
import { useQueryClient } from '@tanstack/react-query';
import { scheduleV2SnapshotQueryOptions } from '@/lib/queries/schedule';
import { todayYmd } from '@/lib/scheduling/date';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import {
  shouldHandleRouteTransitionClick,
  shouldStartRouteTransitionForHref,
  usePortalRouteTransition,
} from '@/components/page-state/PortalRouteTransition';
import Link from '@/components/navigation/PortalRouteLink';
import {
  openPortalIndexInstantly,
  portalIndexTarget,
  preloadPortalIndex,
} from '@/lib/queries/portalIndexNavigation';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;

  const aliases: Record<string, string[]> = {
    '/staff/projects': ['/projects'],
    '/contacts': ['/staff/contacts'],
    '/schedule': ['/staff/schedule'],
    '/imports': ['/admin/imports'],
    '/pricebook': ['/admin/costing', '/admin/costs'],
  };

  const matches = aliases[href];
  if (!matches) return false;
  return matches.some((match) => pathname === match || pathname.startsWith(`${match}/`));
}

export default function SidebarRail({
  email,
  roleLabel,
  role,
  panelVisible = false,
}: {
  email?: string;
  roleLabel?: string;
  role?: 'admin' | 'staff';
  panelVisible?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === 'admin');
  const queryClient = useQueryClient();
  const { beginInstantRoute } = usePortalRouteTransition();

  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const today = useMemo(() => todayYmd(), []);
  const prefetchedRef = useRef(new Set<string>());

  const prefetchFor = useCallback(
    (key: string, href: string) => {
      if (portalIndexTarget(href)) {
        preloadPortalIndex(queryClient, router, href);
        return;
      }
      const routeToken = `route:${href}`;
      if (!prefetchedRef.current.has(routeToken)) {
        prefetchedRef.current.add(routeToken);
        router.prefetch(href);
      }
      if (key !== 'schedule') return;
      const token = `${key}:${hostKey}:${today}`;
      if (prefetchedRef.current.has(token)) return;
      prefetchedRef.current.add(token);
      void queryClient.prefetchQuery(scheduleV2SnapshotQueryOptions(hostKey, today));
    },
    [hostKey, queryClient, router, today],
  );

  const handleNavClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
      if (!shouldHandleRouteTransitionClick(event)) return;
      if (!shouldStartRouteTransitionForHref(href)) return;
      // PortalRouteLink owns offline presentation and ordinary transitions.
      // The index shortcut is online-only because router.replace needs a live
      // route response.
      if (navigator.onLine === false) return;
      const indexTarget = portalIndexTarget(href);
      if (indexTarget) {
        beginInstantRoute(indexTarget.route);
        if (openPortalIndexInstantly(event, router, href)) return;
      }
    },
    [beginInstantRoute, router],
  );

  return (
    <aside
      className={styles.rail}
      data-portal-sidebar-rail="true"
      data-sidebar-panel-visible={panelVisible ? 'true' : undefined}
    >
      <div className={styles.section}>
        <nav className={styles.nav} aria-label="Portal navigation">
          {visibleItems.map(({ key, label, href, Icon }) => {
            const active = isActive(pathname, href);

            return (
              <Link
                key={key}
                href={href}
                prefetch={false}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cx(styles.iconButton, active && styles.iconButtonActive)}
                data-nav-key={key}
                onClick={(event) => handleNavClick(event, href)}
                onMouseEnter={() => prefetchFor(key, href)}
                onFocus={() => prefetchFor(key, href)}
                onPointerDown={() => prefetchFor(key, href)}
                onTouchStart={() => prefetchFor(key, href)}
              >
                {active ? <span className={styles.activeBar} aria-hidden="true" /> : null}
                <Icon
                  aria-hidden="true"
                  size={20}
                  strokeWidth={2}
                  className={styles.icon}
                />
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.bottom}>
        <UserMenu email={email} roleLabel={roleLabel} />
      </div>
    </aside>
  );
}
