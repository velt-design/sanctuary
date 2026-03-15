'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useRef } from 'react';
import { NAV_ITEMS, SIDEBAR_WIDTH_PX } from './navItems';
import UserMenu from './UserMenu';
import styles from './SidebarRail.module.css';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQueryClient } from '@tanstack/react-query';
import { scheduleV2SnapshotQueryOptions } from '@/lib/queries/schedule';
import { todayYmd } from '@/lib/scheduling/date';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

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
}: {
  email?: string;
  roleLabel?: string;
  role?: 'admin' | 'staff';
}) {
  const pathname = usePathname();
  const tooltipsEnabled = pathname !== '/staff/sidebar-lab';
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === 'admin');
  const queryClient = useQueryClient();

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

  return (
    <TooltipProvider delayDuration={150}>
      <aside className={styles.rail} style={{ width: SIDEBAR_WIDTH_PX }} data-portal-sidebar-rail="true">
        <div className={styles.section}>
          <nav className={styles.nav} aria-label="Portal navigation">
            {visibleItems.map(({ key, label, href, Icon }) => {
              const active = isActive(pathname, href);
              const iconLink = (
                <Link
                  key={key}
                  href={href}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  className={cx(styles.iconButton, active && styles.iconButtonActive)}
                  data-nav-key={key}
                  onMouseEnter={() => prefetchFor(key)}
                  onFocus={() => prefetchFor(key)}
                >
                  {active ? <span className={styles.activeBar} aria-hidden="true" /> : null}
                  <Icon
                    aria-hidden="true"
                    size={22}
                    strokeWidth={2}
                    className={styles.icon}
                    style={{ opacity: active ? 1 : 0.85 }}
                  />
                </Link>
              );

              if (!tooltipsEnabled) return iconLink;

              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>{iconLink}</TooltipTrigger>
                  <TooltipContent side="right" align="center">
                    {label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </div>

        <div className={styles.bottom}>
          <UserMenu email={email} roleLabel={roleLabel} />
        </div>
      </aside>
    </TooltipProvider>
  );
}
