'use client';

import Link from 'next/link';
import styles from './quoteViewer.module.css';

export function QuoteTopBarActions() {
  return (
    <div className={styles.topBarActions}>
      <Link href="/contact" className={styles.topBarButton}>
        Contact Sanctuary
      </Link>
      <button type="button" className={styles.topBarButton} onClick={() => window.print()}>
        Download
      </button>
    </div>
  );
}
