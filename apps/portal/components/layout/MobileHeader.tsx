'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useEffect, useId, useMemo, useState } from 'react';
import styles from './MobileHeader.module.css';
import { getPortalNavItems, isPortalNavActive, type PortalRole } from './portalNav';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function MobileHeader({ email, role }: { email: string; role: PortalRole }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuId = useId();
  const { signOut } = usePortalSession();

  const items = useMemo(() => getPortalNavItems(role), [role]);
  const activePathname = mounted ? pathname : null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const roleLabel = role === 'admin' ? 'Admin' : 'Staff';

  return (
    <>
      <div className={styles.bar}>
        <Link
          href="/dashboard"
          className={styles.brand}
          aria-label="Sanctuary Pergolas portal home"
          onClick={() => setOpen(false)}
        >
          SANCTUARY&nbsp;PERGOLAS
        </Link>

        <button
          type="button"
          className={styles.menuButton}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-haspopup="dialog"
          aria-controls={open ? menuId : undefined}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={styles.dot} aria-hidden="true" />
          <span className={cx(styles.pulse, open && styles.pulseOpen)} aria-hidden="true" />
        </button>
      </div>

      {mounted && open
        ? createPortal(
            <div className={styles.overlay} aria-hidden={!open}>
              <div
                className={styles.overlayBackdrop}
                onPointerDown={(e) => {
                  if (e.currentTarget === e.target) setOpen(false);
                }}
              >
                <div
                  id={menuId}
                  className={styles.menu}
                  role="dialog"
                  aria-label="Portal menu"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <nav aria-label="Portal navigation" className={styles.nav}>
                    {items.map((item) => {
                      const active = isPortalNavActive(activePathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch
                          className={cx(styles.navLink, active && styles.navLinkActive)}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => setOpen(false)}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>

                  <div className={styles.divider} role="separator" />

                  <div className={styles.account}>
                    <div className={styles.accountRow}>
                      <span className={styles.accountLabel}>Signed in as</span>
                      <span className={styles.accountValue} title={email}>
                        {email}
                      </span>
                    </div>
                    <div className={styles.accountRow}>
                      <span className={styles.accountLabel}>Access</span>
                      <span className={styles.accountValue}>{roleLabel}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.logout}
                      onClick={() => {
                        setOpen(false);
                        void signOut('/login');
                      }}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
