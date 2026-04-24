'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from '@/components/ui/surface/PortalSurface.module.css';

export type MoreMenuItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export default function MoreMenu({
  label = 'More',
  items,
  disabled,
}: {
  label?: string;
  items: MoreMenuItem[];
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: Event) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const enabledItems = items.filter((i) => i && typeof i.label === 'string' && i.label.trim());
  if (!enabledItems.length) return null;

  return (
    <div className={styles.moreMenu} ref={wrapRef}>
      <button
        type="button"
        className={styles.buttonSecondary}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={Boolean(disabled)}
      >
        {label}
      </button>
      {open ? (
        <div className={styles.moreMenuPopover} role="menu">
          {enabledItems.map((item) => {
            const className = cx(styles.moreMenuItem, item.danger && styles.moreMenuItemDanger, item.disabled && styles.moreMenuItemDisabled);
            if (item.href) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={className}
                  role="menuitem"
                  aria-disabled={item.disabled}
                  tabIndex={item.disabled ? -1 : 0}
                  onClick={(e) => {
                    if (item.disabled) {
                      e.preventDefault();
                      return;
                    }
                    setOpen(false);
                  }}
                >
                  {item.label}
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                className={className}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
