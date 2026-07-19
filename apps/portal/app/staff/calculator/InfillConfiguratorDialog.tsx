import { useEffect, useRef, type ReactNode } from 'react';
import Modal from '@/components/ui/modal/Modal';
import styles from './CalculatorGrid.module.css';
import {
  INFILL_CONFIGURATOR_STAGES,
  canVisitInfillStage,
  type InfillConfiguratorStage,
} from './infillConfiguratorPresentation';

type InfillConfiguratorDialogProps = {
  closeOnEsc: boolean;
  rail: ReactNode;
  editorHeader: ReactNode;
  stage: InfillConfiguratorStage;
  openingComplete: boolean;
  blockerCount: number;
  onStageChange: (stage: InfillConfiguratorStage) => void;
  onClose: () => void;
  children: ReactNode;
  notice?: ReactNode;
};

export default function InfillConfiguratorDialog({
  closeOnEsc,
  rail,
  editorHeader,
  stage,
  openingComplete,
  blockerCount,
  onStageChange,
  onClose,
  children,
  notice,
}: InfillConfiguratorDialogProps) {
  const guidedBodyRef = useRef<HTMLDivElement>(null);
  const stageIndex = INFILL_CONFIGURATOR_STAGES.findIndex((entry) => entry.id === stage);
  const previous = stageIndex > 0 ? INFILL_CONFIGURATOR_STAGES[stageIndex - 1]?.id : null;
  const next = stageIndex < INFILL_CONFIGURATOR_STAGES.length - 1 ? INFILL_CONFIGURATOR_STAGES[stageIndex + 1]?.id : null;

  useEffect(() => {
    if (guidedBodyRef.current) guidedBodyRef.current.scrollTop = 0;
  }, [stage]);

  return (
    <Modal
      open
      ariaLabel="Infills"
      onClose={onClose}
      closeOnEsc={closeOnEsc}
      overlayClassName={styles.infillDrawerOverlay}
      panelClassName={styles.infillDrawerPanel}
      maxWidthPx={1520}
    >
      <div className={styles.infillDrawer}>
        <div className={styles.infillDrawerHeader}>
          <div>
            <h2 className={styles.infillDrawerTitle}>Infills</h2>
            <p className={styles.infillDrawerSubtitle}>Describe the opening, confirm its fixing members, then review the production result.</p>
          </div>
          <button type="button" className={styles.infillDrawerClose} onClick={onClose}>Close</button>
        </div>

        <div className={styles.infillDrawerBody}>
          {rail}
          <section className={styles.infillEditor} aria-label="Selected infill editor">
            {editorHeader}
            <ol className={styles.infillStageNav} aria-label="Infill setup progress">
              {INFILL_CONFIGURATOR_STAGES.map((entry, index) => {
                const enabled = canVisitInfillStage(entry.id, openingComplete);
                const active = entry.id === stage;
                const label = entry.id === 'results' && blockerCount > 0 ? `${entry.label} (${blockerCount})` : entry.label;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={active ? `${styles.infillStageButton} ${styles.infillStageButtonActive}` : styles.infillStageButton}
                      aria-current={active ? 'step' : undefined}
                      disabled={!enabled}
                      onClick={() => onStageChange(entry.id)}
                    >
                      <span className={styles.infillStageNumber}>{index + 1}</span>
                      <span>{label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className={styles.infillStageCompact} aria-live="polite">
              {`Step ${stageIndex + 1} of ${INFILL_CONFIGURATOR_STAGES.length} — ${INFILL_CONFIGURATOR_STAGES[stageIndex]?.label ?? 'Opening'}${stage === 'results' && blockerCount > 0 ? ` (${blockerCount} to fix)` : ''}`}
            </p>
            <div ref={guidedBodyRef} className={styles.infillGuidedBody} aria-live="polite">{children}</div>
          </section>
        </div>

        <div className={styles.infillDrawerFooter}>
          <span className={styles.infillDrawerFooterNote} role="status">
            {stage === 'opening' && !openingComplete
              ? 'Enter the required opening measurements to continue.'
              : 'Changes save automatically to this calculator draft.'}
          </span>
          <div className={styles.infillGuidedFooterActions}>
            {previous ? (
              <button type="button" className={styles.infillSecondaryButton} onClick={() => onStageChange(previous)}>Back</button>
            ) : null}
            {next ? (
              <button
                type="button"
                className={styles.modalButtonPrimary}
                disabled={!canVisitInfillStage(next, openingComplete)}
                onClick={() => onStageChange(next)}
              >
                Continue
              </button>
            ) : (
              <button type="button" className={styles.modalButtonPrimary} onClick={onClose}>Done</button>
            )}
          </div>
        </div>
        {notice}
      </div>
    </Modal>
  );
}
