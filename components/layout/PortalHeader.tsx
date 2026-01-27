'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import SessionMenu from '@/components/auth/SessionMenu';
import styles from './PortalHeader.module.css';
import HeaderHistoryNav from './HeaderHistoryNav';
import SaveStatusPill from './SaveStatusPill';
import { getPortalNavItems, isPortalNavActive, type PortalRole } from './portalNav';
import MobileHeader from './MobileHeader';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function PortalHeader({ email, role }: { email: string; role: PortalRole }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const items = getPortalNavItems(role);

  useEffect(() => setMounted(true), []);
  const activePathname = mounted ? pathname : null;

  return (
    <header className={styles.header}>
      <div className={styles.mobileOnly}>
        <MobileHeader email={email} role={role} />
      </div>

      <div className={styles.inner}>
        <nav className={styles.nav} aria-label="Portal navigation">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={cx(styles.navLink, isPortalNavActive(activePathname, item.href) && styles.navLinkActive)}
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
