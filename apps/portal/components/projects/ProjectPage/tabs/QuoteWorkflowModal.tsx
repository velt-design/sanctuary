'use client';

import type { ReactNode } from 'react';
import Modal from '@/components/ui/modal/Modal';
import styles from './QuotesTab.module.css';

export default function QuoteWorkflowModal({
  children,
  label,
  onClose,
  panelClassName,
  maxWidthPx = 720,
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
  panelClassName?: string;
  maxWidthPx?: number;
}) {
  return (
    <Modal open onClose={onClose} ariaLabel={label} panelClassName={panelClassName ?? styles.modal} maxWidthPx={maxWidthPx}>
      {children}
    </Modal>
  );
}
