'use client';

import { type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { PortalMenu } from '../PortalFloatingPanel';
import controls from './FoundationControls.module.css';
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
  const triggerClassName = [
    visibleLabel ? controls.button : controls.iconButton,
    visibleLabel ? controls.buttonSecondary : controls.iconButtonSecondary,
    controls.controlSmall,
  ].join(' ');

  return (
    <PortalMenu
      label={menuLabel ?? label}
      triggerAriaLabel={label}
      triggerClassName={triggerClassName}
      trigger={<><MoreHorizontal aria-hidden="true" />{visibleLabel ? <span>{label}</span> : null}</>}
      contentClassName={styles.content}
      heading={menuLabel ? <div className={styles.label}>{menuLabel}</div> : undefined}
      items={items.map((item) => ({
        id: item.label,
        label: <>{item.icon ? <span className={styles.icon}>{item.icon}</span> : null}<span>{item.label}</span></>,
        onSelect: () => item.onSelect?.(),
        disabled: item.disabled,
        separatorBefore: item.separatorBefore,
        className: item.destructive ? styles.destructive : undefined,
      }))}
    />
  );
}
