'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import MoreMenu, { type MoreMenuItem } from '@/components/portal/MoreMenu';
import surface from '@/components/ui/surface/PortalSurface.module.css';
import styles from './PageHeader.module.css';

type HeaderPrimaryAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function actionClassName(tone: HeaderPrimaryAction['tone'] = 'primary') {
  if (tone === 'danger') return surface.buttonDanger;
  if (tone === 'secondary') return surface.buttonSecondary;
  return surface.button;
}

export default function PageHeader({
  title,
  subtitle,
  meta,
  right,
  back,
  primaryAction,
  secondaryActions,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  back?: { label: string; href: string } | null;
  primaryAction?: HeaderPrimaryAction | null;
  secondaryActions?: MoreMenuItem[] | null;
  className?: string;
}) {
  const rootClassName = cx(styles.root, className);
  const primaryLabel = primaryAction?.loading ? 'Working…' : primaryAction?.label;
  const hasActions = Boolean(back || primaryAction || (secondaryActions && secondaryActions.length) || right || meta);

  return (
    <header className={rootClassName}>
      <div className={styles.row}>
        <div className={styles.identity}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
        </div>

        {hasActions ? (
          <div className={styles.right}>
            {meta ? <div className={styles.meta}>{meta}</div> : null}
            {back ? (
              <Link className={surface.buttonSecondary} href={back.href}>
                {back.label}
              </Link>
            ) : null}
            {primaryAction ? (
              primaryAction.href ? (
                <Link
                  className={actionClassName(primaryAction.tone)}
                  href={primaryAction.href}
                  aria-disabled={Boolean(primaryAction.disabled || primaryAction.loading)}
                >
                  {primaryLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  className={actionClassName(primaryAction.tone)}
                  onClick={primaryAction.onClick}
                  disabled={Boolean(primaryAction.disabled || primaryAction.loading)}
                >
                  {primaryLabel}
                </button>
              )
            ) : null}
            {secondaryActions && secondaryActions.length ? (
              <MoreMenu items={secondaryActions} disabled={Boolean(primaryAction?.loading)} />
            ) : null}
            {right}
          </div>
        ) : null}
      </div>
    </header>
  );
}
