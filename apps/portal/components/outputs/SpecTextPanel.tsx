'use client';

import { useState } from 'react';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import outputStyles from './OutputsPanel.module.css';

export default function SpecTextPanel({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <section className={styles.section} aria-label="Builder spec">
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
        <pre className={outputStyles.specText}>{text}</pre>
      </div>
    </section>
  );
}
