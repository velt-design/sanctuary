'use client';

import { CircleUser, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import styles from './UserMenu.module.css';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function UserMenu({ email, roleLabel }: { email?: string; roleLabel?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="User menu" className={styles.trigger}>
          <CircleUser aria-hidden="true" size={22} strokeWidth={2} className={styles.icon} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="end">
        <DropdownMenuLabel>
          <div className={styles.labelContent}>
            <span className={styles.email} title={email ?? ''}>
              {email ?? 'Signed in'}
            </span>
            <span className={styles.role}>{roleLabel ?? 'Admin access'}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={styles.signOutItem}
          onSelect={() => {
            signOut({ callbackUrl: '/login' });
          }}
        >
          <LogOut aria-hidden="true" className={styles.signOutIcon} size={16} strokeWidth={2} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
