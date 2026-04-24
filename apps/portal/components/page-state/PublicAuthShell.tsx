import type { ReactNode } from 'react';
import styles from './PageState.module.css';

export default function PublicAuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.publicPage}>
      <section className={styles.publicCard}>
        <div>
          <p className={styles.publicEyebrow}>{eyebrow}</p>
          <h1 className={styles.publicTitle}>{title}</h1>
        </div>
        <p className={styles.publicDescription}>{description}</p>
        <div className={styles.publicBody}>{children}</div>
      </section>
    </main>
  );
}
