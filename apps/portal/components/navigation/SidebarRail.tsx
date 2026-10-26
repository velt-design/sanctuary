'use client';

import Link from 'next/link';
import { isNavParentActive as isActive } from './navRouteMatch';
import { usePathname, useRouter } from 'next/navigation';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useRef } from 'react';
import { visibleNavItems } from './navItems';
import UserMenu from './UserMenu';
import styles from './SidebarRail.module.css';
import { useQueryClient } from '@tanstack/react-query';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransitionContext';
import { handlePortalNavigationClick, preloadPortalNavigation } from '@/lib/queries/portalIndexNavigation';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}


export default function SidebarRail({
  email,
  roleLabel,
  role,
  panelVisible = false,
  financeAccess = false,
}: {
  email?: string;
  roleLabel?: string;
  role?: 'admin' | 'staff';
  panelVisible?: boolean;
  financeAccess?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleItems = visibleNavItems(role, financeAccess, email);
  const queryClient = useQueryClient();
  const { beginInstantRoute, beginRouteTransition } = usePortalRouteTransition();

  const prefetchedRef = useRef(new Set<string>());

  const prefetchFor = useCallback(
    (_key: string, href: string) => preloadPortalNavigation(queryClient, router, href, prefetchedRef.current),
    [queryClient, router],
  );

  const handleNavClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>, href: string, label: string) => {
      handlePortalNavigationClick(event, router, href, { beginInstantRoute, beginRouteTransition }, {
        label, source: 'sidebar-rail', control: event.currentTarget,
      });
    },
    [beginInstantRoute, beginRouteTransition, router],
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
                onClick={(event) => handleNavClick(event, href, label)}
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
