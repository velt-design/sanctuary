'use client';

import styles from './PortalHeader.module.css';
import HeaderHistoryNav from './HeaderHistoryNav';
import SaveStatusPill from './SaveStatusPill';

export default function PortalHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.right}>
          <HeaderHistoryNav />
          <SaveStatusPill />
        </div>
      </div>
    </header>
  );
}
