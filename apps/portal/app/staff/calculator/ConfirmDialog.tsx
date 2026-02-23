import Modal from '@/components/ui/modal/Modal';
import styles from './CalculatorGrid.module.css';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <Modal
      open
      ariaLabel={title}
      onClose={onCancel}
      overlayClassName={styles.modalOverlay}
      panelClassName={styles.modal}
      maxWidthPx={560}
    >
      <div className={styles.modalHeader}>
        <div>
          <h2 className={styles.modalTitle}>{title}</h2>
        </div>
        <button type="button" className={styles.modalClose} onClick={onCancel}>
          Close
        </button>
      </div>

      <div className={styles.modalBody}>
        <p className={styles.modalNote}>{body}</p>
      </div>

      <div className={styles.modalFooter}>
        <button type="button" className={styles.modalButtonSecondary} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={danger ? `${styles.modalButtonPrimary} ${styles.modalButtonDanger}` : styles.modalButtonPrimary}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

