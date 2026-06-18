'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';
import { lockDocumentScroll, unlockDocumentScroll } from '../scrollLock';

const MODAL_DEFAULTS = {
  closeOnBackdrop: true,
  closeOnEsc: true,
  maxWidthPx: 720,
} as const;

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;

  ariaLabel: string;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;

  maxWidthPx?: number;
  overlayClassName?: string;
  panelClassName?: string;

  initialFocusRef?: React.RefObject<HTMLElement | null>;
};

export default function Modal({
  open,
  onClose,
  children,
  ariaLabel,
  closeOnBackdrop = MODAL_DEFAULTS.closeOnBackdrop,
  closeOnEsc = MODAL_DEFAULTS.closeOnEsc,
  maxWidthPx = MODAL_DEFAULTS.maxWidthPx,
  overlayClassName,
  panelClassName,
  initialFocusRef,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const portalRoot = typeof document === 'undefined' ? null : document.body;

  const overlayClasses = useMemo(() => {
    return overlayClassName ?? styles.overlay;
  }, [overlayClassName]);

  const panelClasses = useMemo(() => {
    return panelClassName ?? styles.panel;
  }, [panelClassName]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;

    lockDocumentScroll();

    const prevFocus = document.activeElement as HTMLElement | null;

    const focusTarget = () => {
      const node = initialFocusRef?.current ?? panelRef.current;
      if (!node) return;
      if (typeof node.focus !== 'function') return;
      try {
        node.focus({ preventScroll: true });
      } catch {
        node.focus();
      }
    };

    const t = window.setTimeout(focusTarget, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!closeOnEsc) return;
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onCloseRef.current();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKeyDown);
      unlockDocumentScroll();

      if (prevFocus && typeof prevFocus.focus === 'function') {
        try {
          prevFocus.focus({ preventScroll: true });
        } catch {
          prevFocus.focus();
        }
      }
    };
  }, [closeOnEsc, initialFocusRef, open]);

  if (!open) return null;
  if (!portalRoot) return null;

  return createPortal(
    <div
      className={overlayClasses}
      onMouseDown={(e) => {
        if (!closeOnBackdrop) return;
        if (e.target !== e.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={panelRef}
        className={panelClasses}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        style={{ maxWidth: maxWidthPx }}
      >
        {children}
      </div>
    </div>,
    portalRoot,
  );
}
