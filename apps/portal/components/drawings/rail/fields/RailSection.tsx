'use client';

import type { ReactNode } from 'react';
import styles from '../WorkbenchRail.module.css';

/**
 * `title` is optional so a parent can wrap the section with its own
 * heading and pass the children through bare — used by HouseFormInspector
 * after PR-T7, where the outer DIMENSIONS heading comes from the
 * inspector and the embedded rail just renders the field stack.
 */
export function RailSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      {title ? <h4 className={styles.sectionTitle}>{title}</h4> : null}
      <div className={styles.fieldStack}>{children}</div>
    </section>
  );
}
