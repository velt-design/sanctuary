import { useEffect, useMemo, useState } from 'react';
import styles from './CalculatorGrid.module.css';
import type { InfillWarningFix, InfillWarningItem } from './infillCompute';

type ResolveWarningsPanelProps = {
  open: boolean;
  warnings: InfillWarningItem[];
  onClose: () => void;
  onJumpToField: (warning: InfillWarningItem) => void;
  onApplyFix: (fix: InfillWarningFix, warning: InfillWarningItem) => void;
};

function warningReason(warning: InfillWarningItem): string {
  if (warning.severity === 'error') return 'This blocks a valid configuration and should be fixed before finalising.';
  if (warning.severity === 'warning') return 'This can cause unexpected materials, supports, or install outcomes.';
  return 'This is informational guidance to help keep settings intentional.';
}

function fixLabel(fix: InfillWarningFix): string {
  if (fix.type === 'setPreferredAcrylic') {
    return fix.value === 'strip_620' ? 'Set preferred acrylic to 620 strips' : 'Set preferred acrylic to sheet panels';
  }
  if (fix.type === 'setCentreLimit') {
    return `Set centre limit to ${fix.value.toFixed(2)}m`;
  }
  const side =
    fix.key === 'hasTop' ? 'top' : fix.key === 'hasBottom' ? 'bottom' : fix.key === 'hasLeft' ? 'left' : 'right';
  return `Confirm ${side} support exists`;
}

export default function ResolveWarningsPanel({ open, warnings, onClose, onJumpToField, onApplyFix }: ResolveWarningsPanelProps) {
  const [index, setIndex] = useState(0);
  const current = warnings[index] ?? null;

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!warnings.length) {
      setIndex(0);
      return;
    }
    setIndex((prev) => Math.max(0, Math.min(prev, warnings.length - 1)));
  }, [warnings]);

  const step = useMemo(() => (warnings.length ? `${index + 1}/${warnings.length}` : '0/0'), [index, warnings.length]);

  if (!open) return null;

  return (
    <section className={styles.infillResolvePanel} aria-label="Resolve warnings">
      <div className={styles.infillResolveHeader}>
        <div>
          <h4 className={styles.infillComputedGroupTitle}>Resolve warnings</h4>
          <p className={styles.infillComputedNote}>{step}</p>
        </div>
        <button type="button" className={styles.infillIconButton} onClick={onClose}>
          Close
        </button>
      </div>

      {!current ? (
        <p className={styles.infillComputedNote}>No warnings to resolve.</p>
      ) : (
        <div className={styles.infillResolveBody}>
          <p className={styles.infillResolveMessage}>{current.message}</p>
          <p className={styles.infillComputedNote}>{warningReason(current)}</p>

          <div className={styles.infillResolveActions}>
            <button type="button" className={styles.infillIconButton} onClick={() => onJumpToField(current)}>
              Jump to field
            </button>
            {current.fix ? (
              <button type="button" className={styles.infillIconButton} onClick={() => onApplyFix(current.fix as InfillWarningFix, current)}>
                {fixLabel(current.fix)}
              </button>
            ) : null}
          </div>

          <div className={styles.infillResolveStepper}>
            <button type="button" className={styles.infillSecondaryButton} onClick={() => setIndex((prev) => Math.max(0, prev - 1))} disabled={index <= 0}>
              Previous
            </button>
            <button
              type="button"
              className={styles.infillSecondaryButton}
              onClick={() => setIndex((prev) => Math.min(warnings.length - 1, prev + 1))}
              disabled={index >= warnings.length - 1}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
