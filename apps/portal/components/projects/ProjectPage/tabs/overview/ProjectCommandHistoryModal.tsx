'use client';

import type { ReactNode } from 'react';
import Modal from '@/components/ui/modal/Modal';
import styles from './ProjectPrimaryActionCard.module.css';

export default function ProjectCommandHistoryModal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <Modal open ariaLabel="Recent project command history" onClose={onClose} panelClassName={styles.historyModal}>
    <div className={styles.historyHeader}>
      <h2>Recent project command history</h2>
      <button type="button" onClick={onClose}>Close</button>
    </div>
    <ul className={styles.historyList}>{children}</ul>
  </Modal>;
}
