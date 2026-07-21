'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button, IconButton } from './FoundationControls';
import styles from './OverflowMenu.module.css';

export type OverflowMenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
};

export function OverflowMenu({
  items,
  label = 'More actions',
  menuLabel,
  visibleLabel = false,
}: {
  items: OverflowMenuItem[];
  label?: string;
  menuLabel?: string;
  visibleLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onDocumentKeyDown);
    document.addEventListener('pointerdown', onDocumentPointerDown);
    return () => {
      document.removeEventListener('keydown', onDocumentKeyDown);
      document.removeEventListener('pointerdown', onDocumentPointerDown);
    };
  }, [open]);

  const moveMenuFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const targets = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    if (!targets.length) return;
    const currentIndex = targets.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? targets.length - 1
        : event.key === 'ArrowDown'
          ? (currentIndex + 1 + targets.length) % targets.length
          : event.key === 'ArrowUp'
            ? (currentIndex - 1 + targets.length) % targets.length
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    targets[nextIndex].focus();
  };

  return (
    <div className={styles.root} ref={rootRef}>
      {visibleLabel ? (
          <Button
            ref={triggerRef}
            variant="secondary"
            size="small"
            leadingIcon={<MoreHorizontal aria-hidden="true" />}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {label}
          </Button>
        ) : (
          <IconButton
            ref={triggerRef}
            aria-label={label}
            variant="secondary"
            size="small"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <MoreHorizontal aria-hidden="true" />
          </IconButton>
        )}
      {open ? (
        <div ref={menuRef} role="menu" aria-label={menuLabel ?? label} className={styles.content} onKeyDown={moveMenuFocus}>
        {menuLabel ? <div className={styles.label}>{menuLabel}</div> : null}
        {items.map((item) => (
          <div key={item.label}>
            {item.separatorBefore ? <div role="separator" className={styles.separator} /> : null}
            <button
              type="button"
              role="menuitem"
              className={item.destructive ? styles.destructive : undefined}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect?.();
                triggerRef.current?.focus();
              }}
            >
              {item.icon ? <span className={styles.icon}>{item.icon}</span> : null}
              <span>{item.label}</span>
            </button>
          </div>
        ))}
        </div>
      ) : null}
    </div>
  );
}
