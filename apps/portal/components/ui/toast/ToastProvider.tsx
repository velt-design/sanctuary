'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import styles from './ToastProvider.module.css';

type ToastKind = 'success' | 'error' | 'info';

type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  createdAt: number;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

function newToastId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function labelForKind(kind: ToastKind): string {
  switch (kind) {
    case 'success':
      return 'Success';
    case 'error':
      return 'Error';
    case 'info':
    default:
      return 'Info';
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (typeof handle === 'number') window.clearTimeout(handle);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      // Site-wide policy: only show error toasts (success/info are intentionally suppressed).
      if (kind !== 'error') return;

      const trimmed = String(message ?? '').trim();
      if (!trimmed) return;
      const id = newToastId();

      setToasts((prev) => {
        const next = [{ id, kind, message: trimmed, createdAt: Date.now() }, ...prev];
        return next.slice(0, 5);
      });

      const handle = window.setTimeout(() => remove(id), 6000);
      timers.current.set(id, handle);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.viewport} aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              styles.toast,
              styles.enter,
              t.kind === 'success' && styles.kindSuccess,
              t.kind === 'error' && styles.kindError,
              t.kind === 'info' && styles.kindInfo,
            )}
            role="status"
          >
            <div>
              <p className={styles.message}>{t.message}</p>
              <div className={styles.meta}>{labelForKind(t.kind)}</div>
            </div>
            <button type="button" className={styles.close} onClick={() => remove(t.id)} aria-label="Dismiss notification">
              Close
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>.');
  return ctx;
}
