'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { NAV_ITEMS } from './navItems';
import UserMenu from './UserMenu';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import {
  shouldHandleRouteTransitionClick,
  shouldStartRouteTransitionForHref,
  usePortalRouteTransition,
} from '@/components/page-state/PortalRouteTransition';
import { scheduleV2SnapshotQueryOptions } from '@/lib/queries/schedule';
import { todayYmd } from '@/lib/scheduling/date';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import {
  openPortalIndexInstantly,
  portalIndexTarget,
  preloadPortalIndex,
} from '@/lib/queries/portalIndexNavigation';
import styles from './PortalSidebarPanel.module.css';

type PinnedOpenParentState = {
  routeKey: string;
  keys: Set<string>;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function itemChildren(item: (typeof NAV_ITEMS)[number]) {
  return 'children' in item ? item.children : undefined;
}

function isParentActive(pathname: string, href: string) {
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

function isChildActive(
  parentKey: string,
  childKey: string,
  pathname: string,
  scheduleView: string,
  hashValue: string,
) {
  switch (parentKey) {
    case 'projects': {
      if (childKey === 'all-projects') return pathname === '/projects' || pathname === '/staff/projects';
      if (childKey === 'work-queue') {
        return (
          pathname === '/staff/projects/work-queue'
          || pathname.startsWith('/staff/projects/work-queue/')
        );
      }
      if (childKey === 'new-project') return pathname === '/projects/new' || pathname === '/staff/projects/new';
      if (childKey === 'design-list') {
        return pathname === '/staff/projects/design-packages' || pathname.startsWith('/staff/projects/design-packages/');
      }
      if (childKey === 'running-jobs') {
        return (
          pathname === '/staff/projects/running-jobs' ||
          pathname.startsWith('/staff/projects/running-jobs/') ||
          pathname === '/staff/running-jobs' ||
          pathname.startsWith('/staff/running-jobs/')
        );
      }
      return false;
    }
    case 'contacts': {
      if (childKey === 'all-contacts') return pathname === '/contacts' || pathname === '/staff/contacts';
      if (childKey === 'new-contact') return pathname === '/contacts/new' || pathname === '/staff/contacts/new';
      return false;
    }
    case 'schedule': {
      const schedulePath =
        pathname === '/schedule' ||
        pathname.startsWith('/schedule/') ||
        pathname === '/staff/schedule' ||
        pathname.startsWith('/staff/schedule/');
      if (!schedulePath) return false;

      if (childKey === 'schedule-board') return scheduleView === 'board';
      if (childKey === 'schedule-gantt') return scheduleView === 'gantt';
      return false;
    }
    case 'pricebook': {
      if (childKey === 'pricebook-costing-control') {
        return pathname === '/admin/costing'
          || pathname === '/pricebook'
          || pathname.startsWith('/admin/costs/');
      }
      if (childKey === 'pricebook-calculator') return pathname === '/staff/calculator';
      return false;
    }
    default:
      return false;
  }
}

export default function PortalSidebarPanel({ mode = 'sidebar' }: { mode?: 'sidebar' | 'drawer' }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { email, role } = usePortalSession();
  const { beginInstantRoute, beginRouteTransition } = usePortalRouteTransition();
  const queryClient = useQueryClient();
  const [hashValue, setHashValue] = useState('');
  const [openParentState, setOpenParentState] = useState<PinnedOpenParentState | null>(null);
  const prefetchedRef = useRef(new Set<string>());

  const scheduleView = (searchParams.get('view') || 'board').toLowerCase();
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === 'admin');
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const today = useMemo(() => todayYmd(), []);
  const roleLabel = role === 'admin' ? 'Admin access' : 'Staff access';
  const routeKey = useMemo(
    () => `${pathname}?${searchParams.toString()}#${hashValue}`,
    [hashValue, pathname, searchParams],
  );
  const activeParentKey = useMemo(() => {
    const activeParent = visibleItems.find((item) => {
      if (isParentActive(pathname, item.href)) return true;
      return itemChildren(item)?.some((child) => isChildActive(item.key, child.key, pathname, scheduleView, hashValue));
    });
    return activeParent?.key ?? null;
  }, [hashValue, pathname, scheduleView, visibleItems]);
  const openParentKeys = useMemo(() => {
    if (openParentState?.routeKey === routeKey) return openParentState.keys;
    return activeParentKey ? new Set([activeParentKey]) : new Set<string>();
  }, [activeParentKey, openParentState, routeKey]);

  useEffect(() => {
    const readHash = () => setHashValue(window.location.hash.toLowerCase());
    readHash();
    window.addEventListener('hashchange', readHash);
    window.addEventListener('popstate', readHash);
    return () => {
      window.removeEventListener('hashchange', readHash);
      window.removeEventListener('popstate', readHash);
    };
  }, []);

  useEffect(() => {
    setOpenParentState({
      routeKey,
      keys: activeParentKey ? new Set([activeParentKey]) : new Set<string>(),
    });
  }, [activeParentKey, routeKey]);

  const handleNavLinkClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>, href: string, label: string) => {
      if (!shouldHandleRouteTransitionClick(event)) return;
      if (!shouldStartRouteTransitionForHref(href)) return;
      const indexTarget = portalIndexTarget(href);
      if (indexTarget) {
        beginInstantRoute(indexTarget.route);
        if (openPortalIndexInstantly(event, router, href)) return;
      }
      beginRouteTransition({ href, label, source: 'sidebar-panel', control: event.currentTarget });
    },
    [beginInstantRoute, beginRouteTransition, router],
  );

  const handleChevronClick = useCallback(
    (key: string) => {
      setOpenParentState((current) => {
        const nextKeys = current?.routeKey === routeKey ? new Set(current.keys) : new Set(openParentKeys);
        if (nextKeys.has(key)) {
          nextKeys.delete(key);
        } else {
          nextKeys.add(key);
        }
        return { routeKey, keys: nextKeys };
      });
    },
    [openParentKeys, routeKey],
  );

  const prefetchFor = useCallback(
    (key: string, href: string) => {
      if (portalIndexTarget(href)) {
        preloadPortalIndex(queryClient, router, href);
        return;
      }
      if (key !== 'schedule') return;
      const token = `${key}:${hostKey}:${today}`;
      if (prefetchedRef.current.has(token)) return;
      prefetchedRef.current.add(token);
      void queryClient.prefetchQuery(scheduleV2SnapshotQueryOptions(hostKey, today));
    },
    [hostKey, queryClient, router, today],
  );

  const handleIconLinkClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>, href: string, label: string) => {
      if (!shouldHandleRouteTransitionClick(event)) return;
      if (!shouldStartRouteTransitionForHref(href)) return;
      const indexTarget = portalIndexTarget(href);
      if (indexTarget) {
        beginInstantRoute(indexTarget.route);
        if (openPortalIndexInstantly(event, router, href)) return;
      }
      beginRouteTransition({ href, label, source: 'sidebar-rail', control: event.currentTarget });
    },
    [beginInstantRoute, beginRouteTransition, router],
  );

  return (
    <div
      className={styles.panel}
      aria-label="Portal navigation"
      data-portal-sidebar-panel="true"
      data-portal-sidebar-presentation={mode}
    >
      <div className={styles.labelLayer} aria-hidden="false">
        <div className={styles.labelNav}>
          {visibleItems.map((item) => {
            const children = itemChildren(item);
            const hasSubmenu = Boolean(children?.length);
            const isParentCurrent =
              isParentActive(pathname, item.href) ||
              Boolean(children?.some((child) => isChildActive(item.key, child.key, pathname, scheduleView, hashValue)));
            const isSubmenuOpen = hasSubmenu && openParentKeys.has(item.key);

            return (
              <div key={item.key} className={styles.parentGroup} data-sidebar-parent-key={item.key}>
                <div className={cx(styles.parentRow, isParentCurrent && styles.parentRowBubbled)}>
                  <Link
                    href={item.href}
                    prefetch={portalIndexTarget(item.href) ? false : undefined}
                    aria-label={item.label}
                    aria-current={isParentCurrent ? 'page' : undefined}
                    className={styles.parentLink}
                    data-nav-key={item.key}
                    onClick={(event) => handleIconLinkClick(event, item.href, item.label)}
                    onMouseEnter={() => prefetchFor(item.key, item.href)}
                    onFocus={() => prefetchFor(item.key, item.href)}
                    onPointerDown={() => prefetchFor(item.key, item.href)}
                    onTouchStart={() => prefetchFor(item.key, item.href)}
                  >
                    <span className={cx(styles.iconButton, isParentCurrent && styles.iconButtonActive)} aria-hidden="true">
                      <item.Icon
                        size={20}
                        strokeWidth={2}
                        className={styles.icon}
                      />
                    </span>
                    <span className={styles.parentLabel}>{item.label}</span>
                  </Link>
                  {hasSubmenu ? (
                    <button
                      type="button"
                      className={styles.chevronButton}
                      aria-label={`${isSubmenuOpen ? 'Collapse' : 'Expand'} ${item.label}`}
                      aria-expanded={isSubmenuOpen}
                      onClick={() => handleChevronClick(item.key)}
                    >
                      <ChevronDown
                        aria-hidden="true"
                        className={cx(styles.chevron, isSubmenuOpen && styles.chevronOpen)}
                      />
                    </button>
                  ) : null}
                </div>

                {hasSubmenu && isSubmenuOpen ? (
                  <div className={cx(styles.submenu, styles.submenuOpen)}>
                    <div className={styles.submenuInner}>
                      {children?.map((child) => {
                        const childActive = isChildActive(item.key, child.key, pathname, scheduleView, hashValue);
                        return (
                          <Link
                            key={child.key}
                            href={child.href}
                            prefetch={portalIndexTarget(child.href) ? false : undefined}
                            aria-current={childActive ? 'page' : undefined}
                            className={cx(styles.childRow, childActive && styles.childRowActive)}
                            onClick={(event) => handleNavLinkClick(event, child.href, child.label)}
                            onMouseEnter={() => prefetchFor(item.key, child.href)}
                            onFocus={() => prefetchFor(item.key, child.href)}
                            onPointerDown={() => prefetchFor(item.key, child.href)}
                            onTouchStart={() => prefetchFor(item.key, child.href)}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className={styles.bottom}>
          <UserMenu email={email ?? undefined} roleLabel={roleLabel} />
        </div>
      </div>
    </div>
  );
}
