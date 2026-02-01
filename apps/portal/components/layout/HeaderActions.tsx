'use client';

import type { ReactNode } from 'react';
import styles from './HeaderActions.module.css';

export default function HeaderActions({ children, className }: { children: ReactNode; className?: string }) {
  const rootClassName = [styles.root, className ?? ''].filter(Boolean).join(' ');

  return <div className={rootClassName}>{children}</div>;
}
