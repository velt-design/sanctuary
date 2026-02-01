'use client';

import { useState } from 'react';
import styles from '@/app/staff/projects/projects.module.css';

export default function SpecTextPanel({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <section className={styles.section} aria-label="Builder spec" style={{ marginTop: 14 }}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Builder spec</h3>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              } catch {
                // ignore
              }
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div className={styles.sectionBody}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.4 }}>{text}</pre>
      </div>
    </section>
  );
}

