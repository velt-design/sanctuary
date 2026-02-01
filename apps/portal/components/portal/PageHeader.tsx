'use client';

import Link from 'next/link';
import styles from '@/app/staff/projects/projects.module.css';
import MoreMenu, { type MoreMenuItem } from './MoreMenu';

type PrimaryAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export default function PageHeader({
  title,
  subtitle,
  back,
  primaryAction,
  secondaryActions,
  meta,
}: {
  title: string;
  subtitle?: string | null;
  back?: { label: string; href: string } | null;
  primaryAction?: PrimaryAction | null;
  secondaryActions?: MoreMenuItem[] | null;
  meta?: React.ReactNode;
}) {
  const primaryLabel = primaryAction?.loading ? 'Working…' : primaryAction?.label;

  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      <div className={styles.actions} aria-label="Page actions">
        {meta}
        {back ? (
          <Link className={styles.buttonSecondary} href={back.href}>
            {back.label}
          </Link>
        ) : null}
        {primaryAction ? (
          primaryAction.href ? (
            <Link className={styles.button} href={primaryAction.href} aria-disabled={primaryAction.disabled || primaryAction.loading}>
              {primaryLabel}
            </Link>
          ) : (
            <button
              type="button"
              className={styles.button}
              onClick={primaryAction.onClick}
              disabled={Boolean(primaryAction.disabled || primaryAction.loading)}
            >
              {primaryLabel}
            </button>
          )
        ) : null}
        {secondaryActions && secondaryActions.length ? <MoreMenu items={secondaryActions} disabled={primaryAction?.loading} /> : null}
      </div>
    </div>
  );
}

