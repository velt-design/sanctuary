'use client';

import type { ReactNode } from 'react';
import Modal from '@/components/ui/modal/Modal';
import { ActivityTimeline, Button } from '@/components/ui/foundation';
import styles from './ProjectPrimaryActionCard.module.css';

export default function ProjectCommandHistoryModal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <Modal open ariaLabel="Recent project command history" onClose={onClose}>
    <div className={styles.historyModal}>
      <div className={styles.historyHeader}>
      <h2>Recent project command history</h2>
        <Button type="button" variant="tertiary" size="small" onClick={onClose}>Close</Button>
      </div>
      <ActivityTimeline ariaLabel="Recent project command history">{children}</ActivityTimeline>
    </div>
  </Modal>;
}
