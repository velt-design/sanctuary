'use client';

import Link from 'next/link';
import { createElement, type ReactNode, type HTMLAttributes } from 'react';
import MoreMenu, { type MoreMenuItem } from '@/components/portal/MoreMenu';
import { Button, ButtonLink, type ButtonVariant } from '@/components/ui/foundation/FoundationControls';
import surface from '@/components/ui/surface/PortalSurface.module.css';
import styles from './PageHeader.module.css';

export type PageHeaderVariant = 'default' | 'dashboard' | 'index' | 'detail';

export type HeaderPrimaryAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
};

export type PageHeaderProps = {
  title: string;
  titleAccessory?: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  count?: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  utility?: ReactNode;
  back?: { label: string; href: string } | null;
  primaryAction?: HeaderPrimaryAction | null;
  reservePrimaryAction?: boolean;
  secondaryActions?: MoreMenuItem[] | null;
  className?: string;
  variant?: PageHeaderVariant;
  headingLevel?: 1 | 2 | 3;
  headingProps?: Pick<HTMLAttributes<HTMLHeadingElement>, 'tabIndex' | 'title'>;
};

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function legacyActionClassName(tone: HeaderPrimaryAction['tone'] = 'primary'): string {
  if (tone === 'danger') return surface.buttonDanger;
  if (tone === 'secondary') return surface.buttonSecondary;
  return surface.button;
}

function foundationActionVariant(tone: HeaderPrimaryAction['tone'] = 'primary'): ButtonVariant {
  if (tone === 'danger') return 'destructive';
  if (tone === 'secondary') return 'secondary';
  return 'primary';
}

export default function PageHeader({
  title,
  titleAccessory,
  subtitle,
  description,
  eyebrow,
  breadcrumbs,
  count,
  meta,
  right,
  utility,
  back,
  primaryAction,
  reservePrimaryAction = false,
  secondaryActions,
  className,
  variant = 'default',
  headingLevel = 1,
  headingProps,
}: PageHeaderProps) {
  const usesFoundation = variant !== 'default';
  const variantClass = styles[`variant${variant[0].toUpperCase()}${variant.slice(1)}`];
  const rootClassName = cx(styles.root, usesFoundation && styles.foundation, variantClass, className);
  const primaryLabel = primaryAction?.loading ? 'Working…' : primaryAction?.label;
  const hasActions = Boolean(reservePrimaryAction || back || primaryAction || (secondaryActions && secondaryActions.length) || right || meta);

  const primaryContent = primaryAction ? (
        primaryAction.href ? (
          usesFoundation ? (
            <ButtonLink
              href={primaryAction.href}
              variant={foundationActionVariant(primaryAction.tone)}
              disabled={Boolean(primaryAction.disabled || primaryAction.loading)}
            >
              {primaryLabel}
            </ButtonLink>
          ) : (
            <Link
              className={cx(
                legacyActionClassName(primaryAction.tone),
                (primaryAction.disabled || primaryAction.loading) && styles.actionDisabled,
              )}
              href={primaryAction.href}
              aria-disabled={Boolean(primaryAction.disabled || primaryAction.loading)}
            >
              {primaryLabel}
            </Link>
          )
        ) : (
          usesFoundation ? (
            <Button
              variant={foundationActionVariant(primaryAction.tone)}
              onClick={() => primaryAction.onClick?.()}
              loading={primaryAction.loading}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </Button>
          ) : (
            <button
              type="button"
              className={legacyActionClassName(primaryAction.tone)}
              onClick={primaryAction.onClick}
              disabled={Boolean(primaryAction.disabled || primaryAction.loading)}
            >
              {primaryLabel}
            </button>
          )
        )
      ) : null;

  const actions = hasActions ? (
    <div className={styles.right} data-page-header-actions="true">
      {meta ? <div className={styles.meta}>{meta}</div> : null}
      {back ? (
        usesFoundation ? (
          <ButtonLink href={back.href} variant="secondary">{back.label}</ButtonLink>
        ) : (
          <Link className={surface.buttonSecondary} href={back.href}>{back.label}</Link>
        )
      ) : null}
      {reservePrimaryAction ? <div className={styles.primarySlot}>{primaryContent}</div> : primaryContent}
      {secondaryActions && secondaryActions.length ? (
        <MoreMenu items={secondaryActions} disabled={Boolean(primaryAction?.loading)} />
      ) : null}
      {right}
    </div>
  ) : null;

  return (
    <header className={rootClassName} data-page-header-variant={variant}>
      {breadcrumbs?.length ? (
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          {breadcrumbs.map((item, index) => item.href ? (
            <Link key={`${item.label}-${index}`} href={item.href}>{item.label}</Link>
          ) : (
            <span key={`${item.label}-${index}`} aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}>
              {item.label}
            </span>
          ))}
        </nav>
      ) : null}
      <div className={cx(styles.row, Boolean(utility) && styles.rowWithUtility)} data-page-header-row="true">
        <div className={styles.identity} data-page-header-identity="true">
          {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
          <div className={styles.titleLine} data-page-header-title-line="true">
            {createElement(`h${headingLevel}`, { className: styles.title, ...headingProps }, title)}
            {titleAccessory ? <span className={styles.titleAccessory}>{titleAccessory}</span> : null}
            {count ? <span className={styles.count}>{count}</span> : null}
          </div>
          {description ?? subtitle ? <div className={styles.subtitle}>{description ?? subtitle}</div> : null}
        </div>

        {utility ? <div className={styles.utility} data-page-header-utility="true">{utility}</div> : null}
        {actions}
      </div>
    </header>
  );
}
