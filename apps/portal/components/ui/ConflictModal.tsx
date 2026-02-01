'use client';

import Modal from '@/components/ui/modal/Modal';
import styles from '@/app/staff/projects/projects.module.css';

export default function ConflictModal({
  open,
  title,
  message,
  onClose,
  onRefresh,
  onOverwrite,
  details,
  busy,
}: {
  open: boolean;
  title?: string;
  message: string;
  details?: string;
  busy?: boolean;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  onOverwrite: () => void | Promise<void>;
}) {
  if (!open) return null;

  return (
    <Modal
      open
      ariaLabel="Conflict detected"
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      overlayClassName={styles.modalOverlay}
      panelClassName={styles.modal}
      maxWidthPx={560}
      closeOnBackdrop={!busy}
      closeOnEsc={!busy}
    >
      <div className={styles.modalHeader}>
        <h2 className={styles.modalTitle}>{title ?? 'Updated elsewhere'}</h2>
        <button type="button" className={styles.modalClose} onClick={onClose} disabled={Boolean(busy)}>
          Close
        </button>
      </div>

      <p className={styles.note} style={{ marginTop: 0 }}>
        {message}
      </p>
      {details ? (
        <p className={styles.muted} style={{ marginTop: 8, fontSize: 12 }}>
          {details}
        </p>
      ) : null}

      <div className={styles.modalFooter}>
        <button type="button" className={styles.buttonSecondary} onClick={() => void onRefresh()} disabled={Boolean(busy)}>
          Refresh
        </button>
        <button type="button" className={styles.buttonDanger} onClick={() => void onOverwrite()} disabled={Boolean(busy)}>
          Overwrite
        </button>
      </div>
    </Modal>
  );
}

