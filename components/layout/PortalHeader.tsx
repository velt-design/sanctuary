'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import SessionMenu from '@/components/auth/SessionMenu';
import styles from './PortalHeader.module.css';
import HeaderHistoryNav from './HeaderHistoryNav';
import SaveStatusPill from './SaveStatusPill';

type NavItem = { label: string; href: string; adminOnly?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: 'Projects', href: '/staff/projects' },
  { label: 'Contacts', href: '/staff/contacts' },
  { label: 'Schedule', href: '/staff/schedule' },
  { label: 'Calculator', href: '/staff/calculator' },
  { label: 'Imports', href: '/admin/imports', adminOnly: true },
  { label: 'Pricebook', href: '/admin/costs/materials', adminOnly: true },
  { label: 'Actions', href: '/admin/costs/actions', adminOnly: true },
  { label: 'Overheads', href: '/admin/costs/overheads', adminOnly: true },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function PortalHeader({ email, role }: { email: string; role: 'admin' | 'staff' }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const items = NAV_ITEMS.filter((i) => (i.adminOnly ? role === 'admin' : true));

  useEffect(() => setMounted(true), []);
  const activePathname = mounted ? pathname : null;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <nav className={styles.nav} aria-label="Portal navigation">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={cx(styles.navLink, isActive(activePathname, item.href) && styles.navLinkActive)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.right}>
          <HeaderHistoryNav />
          <SaveStatusPill />
          <SessionMenu email={email} role={role} />
        </div>
      </div>
    </header>
  );
}
