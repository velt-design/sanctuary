'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, SIDEBAR_WIDTH_PX } from './navItems';
import UserMenu from './UserMenu';
import styles from './SidebarRail.module.css';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

export default function SidebarRail({ email, roleLabel }: { email?: string; roleLabel?: string }) {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={150}>
      <aside className={styles.rail} style={{ width: SIDEBAR_WIDTH_PX }}>
        <div className={styles.section}>
          <nav className={styles.nav} aria-label="Portal navigation">
            {NAV_ITEMS.map(({ key, label, href, Icon }) => {
              const active = isActive(pathname, href);

              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      aria-label={label}
                      aria-current={active ? 'page' : undefined}
                      className={cx(styles.iconButton, active && styles.iconButtonActive)}
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
                  </TooltipTrigger>
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
