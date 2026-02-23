import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/modal/Modal';
import styles from './CalculatorGrid.module.css';

type DuplicateDialogResult = {
  count: number;
  labelPattern: string;
};

type DuplicateDialogProps = {
  open: boolean;
  sourceLabel: string;
  onCancel: () => void;
  onConfirm: (result: DuplicateDialogResult) => void;
};

function clampCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(20, parsed));
}

export default function DuplicateDialog({ open, sourceLabel, onCancel, onConfirm }: DuplicateDialogProps) {
  const defaultPattern = useMemo(() => `${sourceLabel || 'Infill'} (copy {i})`, [sourceLabel]);
  const [count, setCount] = useState('2');
  const [pattern, setPattern] = useState(defaultPattern);

  useEffect(() => {
    if (!open) return;
    setCount('2');
    setPattern(defaultPattern);
  }, [defaultPattern, open]);

  if (!open) return null;

  return (
    <Modal
      open
      ariaLabel="Duplicate infill variants"
      onClose={onCancel}
      overlayClassName={styles.modalOverlay}
      panelClassName={styles.modal}
      maxWidthPx={560}
    >
      <div className={styles.modalHeader}>
        <div>
          <h2 className={styles.modalTitle}>Duplicate infill variants</h2>
          <p className={styles.modalSubtitle}>Create multiple copies with a label pattern.</p>
        </div>
        <button type="button" className={styles.modalClose} onClick={onCancel}>
          Close
        </button>
      </div>

      <div className={styles.modalBody}>
        <section className={styles.modalSection} aria-label="Duplicate settings">
          <h3 className={styles.modalSectionTitle}>Settings</h3>
          <div className={styles.modalGrid}>
            <div>
              <label className={styles.modalKey} htmlFor="duplicate-count">
                Count (1-20)
              </label>
              <input
                id="duplicate-count"
                className={styles.control}
                type="number"
                min={1}
                max={20}
                step={1}
                value={count}
                onChange={(event) => setCount(event.target.value)}
              />
            </div>

            <div>
              <label className={styles.modalKey} htmlFor="duplicate-pattern">
                Label pattern
              </label>
              <input
                id="duplicate-pattern"
                className={styles.control}
                type="text"
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
              />
              <p className={styles.modalNote}>Use {'{i}'} for copy number.</p>
            </div>
          </div>
        </section>
      </div>

      <div className={styles.modalFooter}>
        <button type="button" className={styles.modalButtonSecondary} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.modalButtonPrimary}
          onClick={() =>
            onConfirm({
              count: clampCount(count),
              labelPattern: pattern.trim() || defaultPattern,
            })
          }
        >
          Create copies
        </button>
      </div>
    </Modal>
  );
}
