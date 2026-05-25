'use client';

import type { ReactNode } from 'react';
import styles from '../WorkbenchRail.module.css';

export function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      <div className={styles.fieldStack}>{children}</div>
    </section>
  );
}
