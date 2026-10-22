"use client";
import { useCalculatorSessionRead } from "./CalculatorSessionReadContext";
import styles from './CalculatorTrustUi.module.css';
import type { CalculatorLocalDraftStatus } from './useCalculatorDraftSession';

function calculatorLocalDraftStatusLabel(status: CalculatorLocalDraftStatus): string | null {
  if (status.kind === 'saving') return 'Saving locally';
  if (status.kind === 'saved') return 'Saved locally';
  if (status.kind === 'restored') return 'Restored unsaved work';
  if (status.kind === 'error') return 'Local save failed';
  return null;
}

export default function CalculatorDraftStatus({
  status,
  compact = false,
}: {
  status: CalculatorLocalDraftStatus;
  compact?: boolean;
}) {
  const {ready,error,onRetry}=useCalculatorSessionRead();
  const label = !ready ? error ? "Estimate unavailable" : "Reading saved draft…" : calculatorLocalDraftStatusLabel(status);
  if (!label) return null;

  return (
    <div
      className={`${(error || (ready && status.kind === 'error')) ? styles.commandBarDraftStatusError : styles.commandBarDraftStatus}${compact ? ` ${styles.commandBarDraftStatusCompact}` : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      title={ready && compact && status.kind !== 'error' ? 'Browser draft only — use Save to update the estimate.' : undefined}
    >
      <span className={styles.commandBarDraftStatusLabel}>{label}</span>{error ? <><span>{error}</span><button type="button" onClick={onRetry}>Retry</button></> : null}
      {ready && <span className={compact && status.kind !== 'error' ? styles.commandBarDraftStatusHelpCompact : styles.commandBarDraftStatusHelp}>
        Browser draft only — use Save to update the estimate.
      </span>}
    </div>
  );
}
