'use client';

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from '@/components/ui/foundation/FoundationControls';
import { focusableElements, trapTabKey } from '@/components/ui/focusTrap';
import { lockDocumentScroll, unlockDocumentScroll } from '@/components/ui/scrollLock';
import styles from './Drawer.module.css';

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: 'left' | 'right';
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
};

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
  initialFocusRef,
  closeOnBackdrop = true,
  closeOnEsc = true,
}: DrawerProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    lockDocumentScroll();
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      (initialFocusRef?.current ?? (panel ? focusableElements(panel)[0] : null) ?? panel)?.focus({ preventScroll: true });
    }, 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (panel) trapTabKey(event, panel);
      if (closeOnEsc && event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      unlockDocumentScroll();
      previousFocus?.focus({ preventScroll: true });
    };
  }, [closeOnEsc, initialFocusRef, open]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      className={styles.overlay}
      data-drawer-overlay="true"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        className={styles.panel}
        data-side={side}
        data-drawer-panel="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <IconButton aria-label={`Close ${title}`} variant="quiet" onClick={onClose}><X aria-hidden="true" /></IconButton>
        </header>
        <div className={styles.body}>{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
