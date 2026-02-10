'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styles from './SessionMenu.module.css';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';

export default function SessionMenu({ email, role }: { email: string; role: 'admin' | 'staff' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const baseId = useId();
  const { signOut } = usePortalSession();

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (!ref.current) return;
      if (!ref.current.contains(target)) setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const menuId = `${baseId}-session-menu`;
  const roleLabel = role === 'admin' ? 'Admin access' : 'Staff access';

  return (
    <div ref={ref} className={styles.wrapper}>
      <button
        type="button"
        className={styles.pill}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.topRow}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.email} title={email}>
            {email}
          </span>
        </span>
        <span className={styles.role}>{roleLabel}</span>
      </button>

      {open ? (
        <div id={menuId} role="menu" className={styles.dropdown} aria-label="Session menu">
          <p className={styles.menuLabel}>Session</p>
          <button
            type="button"
            role="menuitem"
            className={styles.menuButton}
            onClick={() => {
              setOpen(false);
              void signOut('/login');
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
