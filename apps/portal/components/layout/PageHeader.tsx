'use client';

import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export default function PageHeader({
  title,
  right,
  className,
}: {
  title: string;
  right?: ReactNode;
  className?: string;
}) {
  const rootClassName = [styles.root, className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <div className={styles.row}>
        <h1 className={styles.title}>{title}</h1>
        {right ? <div className={styles.right}>{right}</div> : <div />}
      </div>
    </div>
  );
}
