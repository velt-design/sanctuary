'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { NAV_ITEMS } from './navItems';
import { SIDEBAR_RAIL_WIDTH_PX } from './sidebarLayout';
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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;

  const aliases: Record<string, string[]> = {
    '/projects': ['/staff/projects'],
    '/contacts': ['/staff/contacts'],
    '/schedule': ['/staff/schedule'],
    '/imports': ['/admin/imports'],
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
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === 'admin');
  const queryClient = useQueryClient();
  const { beginRouteTransition } = usePortalRouteTransition();

  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const today = useMemo(() => todayYmd(), []);
  const prefetchedRef = useRef(new Set<string>());

  const prefetchFor = useCallback(
    (key: string) => {
      if (key !== 'schedule') return;
      const token = `${key}:${hostKey}:${today}`;
      if (prefetchedRef.current.has(token)) return;
      prefetchedRef.current.add(token);
      void queryClient.prefetchQuery(scheduleV2SnapshotQueryOptions(hostKey, today));
    },
    [hostKey, queryClient, today],
  );

  const handleNavClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>, href: string, label: string) => {
      if (!shouldHandleRouteTransitionClick(event)) return;
      if (!shouldStartRouteTransitionForHref(href)) return;

      beginRouteTransition({
        href,
        label,
        source: 'sidebar-rail',
      });
    },
    [beginRouteTransition],
  );

  return (
    <aside
      className={styles.rail}
      style={{ width: SIDEBAR_RAIL_WIDTH_PX }}
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
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cx(styles.iconButton, active && styles.iconButtonActive)}
                data-nav-key={key}
                onClick={(event) => handleNavClick(event, href, label)}
                onMouseEnter={() => prefetchFor(key)}
                onFocus={() => prefetchFor(key)}
              >
                {active ? <span className={styles.activeBar} aria-hidden="true" /> : null}
                <Icon
                  aria-hidden="true"
                  size={20}
                  strokeWidth={2}
                  className={styles.icon}
                  style={{ opacity: active ? 1 : 0.85 }}
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
