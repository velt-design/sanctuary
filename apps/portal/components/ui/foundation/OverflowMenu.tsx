'use client';

import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconButton } from './FoundationControls';
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
}: {
  items: OverflowMenuItem[];
  label?: string;
  menuLabel?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label={label} variant="secondary" size="small">
          <MoreHorizontal aria-hidden="true" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.content}>
        {menuLabel ? <DropdownMenuLabel className={styles.label}>{menuLabel}</DropdownMenuLabel> : null}
        {items.map((item) => (
          <div key={item.label}>
            {item.separatorBefore ? <DropdownMenuSeparator className={styles.separator} /> : null}
            <DropdownMenuItem
              className={item.destructive ? styles.destructive : undefined}
              disabled={item.disabled}
              onSelect={item.onSelect}
            >
              {item.icon ? <span className={styles.icon}>{item.icon}</span> : null}
              <span>{item.label}</span>
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
