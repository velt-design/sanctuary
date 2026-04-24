import type { ReactNode } from 'react';
import styles from './PortalSurface.module.css';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function PortalSection({
  title,
  meta,
  actions,
  children,
  className,
  bodyClassName,
  ariaLabel,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  ariaLabel?: string;
}) {
  return (
    <section className={cx(styles.section, className)} aria-label={ariaLabel}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {actions ?? meta ? <div className={styles.actions}>{meta}{actions}</div> : null}
      </div>
      <div className={cx(styles.sectionBody, bodyClassName)}>{children}</div>
    </section>
  );
}

export function InlineNotice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'error';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(tone === 'error' ? styles.inlineError : styles.inlineNotice, className)}>
      {children}
    </div>
  );
}

export function StatusPill({
  tone = 'default',
  children,
  className,
}: {
  tone?: 'default' | 'sent' | 'paid' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        styles.statusPill,
        tone === 'sent' && styles.statusPillSent,
        tone === 'paid' && styles.statusPillPaid,
        tone === 'danger' && styles.statusPillDanger,
        tone === 'default' && styles.statusPillDraft,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionBody}>
        <div className={styles.stack}>
          <div>
            <div className={styles.sectionTitle}>{title}</div>
            {description ? <p className={styles.note}>{description}</p> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function TableShell({
  children,
  scrollX = false,
  className,
}: {
  children: ReactNode;
  scrollX?: boolean;
  className?: string;
}) {
  return <div className={cx(styles.tableWrap, scrollX && styles.tableWrapScrollX, className)}>{children}</div>;
}
