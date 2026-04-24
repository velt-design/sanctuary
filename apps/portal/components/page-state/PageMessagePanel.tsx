import type { ReactNode } from 'react';
import styles from './PageState.module.css';

export default function PageMessagePanel({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <h1 className={styles.panelTitle}>{title}</h1>
        <p className={styles.panelDescription}>{description}</p>
        {actions ? <div className={styles.actionRow}>{actions}</div> : null}
      </section>
    </main>
  );
}
