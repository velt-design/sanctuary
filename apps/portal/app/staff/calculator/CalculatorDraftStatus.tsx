import styles from './CalculatorTrustUi.module.css';
import type { CalculatorLocalDraftStatus } from './useCalculatorDraftSession';

function calculatorLocalDraftStatusLabel(status: CalculatorLocalDraftStatus): string | null {
  if (status.kind === 'saving') return 'Saving locally';
  if (status.kind === 'saved') return 'Saved locally';
  if (status.kind === 'restored') return 'Restored unsaved work';
  if (status.kind === 'error') return 'Local save failed';
  return null;
}

export default function CalculatorDraftStatus({ status }: { status: CalculatorLocalDraftStatus }) {
  const label = calculatorLocalDraftStatusLabel(status);
  if (!label) return null;

  return (
    <div
      className={status.kind === 'error' ? styles.commandBarDraftStatusError : styles.commandBarDraftStatus}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={styles.commandBarDraftStatusLabel}>{label}</span>
      <span className={styles.commandBarDraftStatusHelp}>Browser draft only — use Save to update the estimate.</span>
    </div>
  );
}
