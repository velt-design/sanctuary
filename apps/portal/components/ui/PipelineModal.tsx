'use client';

import * as React from 'react';
import { ArrowLeft, X } from 'lucide-react';
import Modal from '@/components/ui/modal/Modal';
import { IconButton } from '@/components/ui/foundation/FoundationControls';
import styles from './PipelineModal.module.css';

type PipelineModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  title: string;
  description?: string;

  children?: React.ReactNode;

  actions: React.ReactNode;

  hint?: React.ReactNode;

  size?: 'sm' | 'md';

  onBack?: () => void;
};

export const PIPELINE_MODAL_ACTION_CLASSES = {
  primary: `${styles.buttonBase} ${styles.buttonPrimary}`,
  secondary: `${styles.buttonBase} ${styles.buttonSecondary}`,
  danger: `${styles.buttonBase} ${styles.buttonDanger}`,
} as const;

export function PipelineModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  hint,
  size = 'md',
  onBack,
}: PipelineModalProps) {
  const maxWidthPx = size === 'sm' ? 460 : 560;

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      ariaLabel={title}
      maxWidthPx={maxWidthPx}
    >
      <div className={styles.body}>
        <div className={styles.header}>
          <div className={styles.headerMain}>
            {onBack ? (
              <IconButton
                aria-label="Back"
                variant="quiet"
                size="standard"
                onClick={onBack}
              >
                <ArrowLeft aria-hidden="true" />
              </IconButton>
            ) : null}
            <div className={styles.headerText}>
              <h2 className={styles.title}>{title}</h2>
              {description ? (
                <div className={styles.description}>{description}</div>
              ) : null}
            </div>
          </div>

          <IconButton
            aria-label="Close"
            variant="quiet"
            size="standard"
            onClick={() => onOpenChange(false)}
          >
            <X aria-hidden="true" />
          </IconButton>
        </div>

        {children ? <div className={styles.content}>{children}</div> : null}

        <div className={styles.actions}>{actions}</div>

        {hint ? <div className={styles.hint}>{hint}</div> : null}
      </div>
    </Modal>
  );
}
