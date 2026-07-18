'use client';

import Modal from '@/components/ui/modal/Modal';
import { useRouter } from 'next/navigation';
import { buildEstimateEntityKey } from '@/lib/localFirst/portalEntities';
import { useAliasedEntitySyncState } from '@/lib/localFirst/useEntitySyncState';
import type { CalculatorEstimateSaveOutcome } from './calculatorEstimateSave';
import { buildCalculatorSaveOutcomeUi } from './calculatorSaveOutcome';
import { buildCalculatorEstimateHandoffRoutes } from './calculatorSaveWorkflow';
import sharedStyles from './CalculatorGrid.module.css';
import styles from './CalculatorSaveOutcomeDialog.module.css';

export default function CalculatorSaveOutcomeDialog({
  outcome,
  onDismiss,
}: {
  outcome: CalculatorEstimateSaveOutcome | null;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const syncState = useAliasedEntitySyncState(
    outcome?.estimateId,
    buildEstimateEntityKey,
    'estimate:detail:__calculator-save-outcome__',
  );
  if (!outcome) return null;

  const ui = buildCalculatorSaveOutcomeUi(outcome, syncState);
  const routes = buildCalculatorEstimateHandoffRoutes(outcome.projectId, outcome.estimateId);
  const navigate = (href: string) => {
    onDismiss();
    router.push(href);
  };
  return (
    <Modal
      open
      ariaLabel="Design saved"
      onClose={onDismiss}
      overlayClassName={sharedStyles.modalOverlay}
      panelClassName={sharedStyles.modal}
      maxWidthPx={680}
    >
      <div className={sharedStyles.modalHeader}>
        <div>
          <h2 className={sharedStyles.modalTitle}>Design saved</h2>
          <p className={sharedStyles.modalSubtitle}>{`${outcome.versionLabel} · ${outcome.operation === 'created' ? 'New design' : 'Updated design'}`}</p>
        </div>
        <button type="button" className={sharedStyles.modalClose} onClick={onDismiss}>
          Close
        </button>
      </div>

      <div className={sharedStyles.modalBody}>
        <section className={`${styles.statusCard} ${styles[ui.syncTone]}`} aria-label="Save and sync status">
          <strong>{ui.syncLabel}</strong>
          <span>{ui.syncDetail}</span>
        </section>
        <section className={sharedStyles.modalSection} aria-label="Costing basis used">
          <h3 className={sharedStyles.modalSectionTitle}>Costing basis</h3>
          <p className={styles.detail}>{ui.costingDetail}</p>
        </section>
        <section className={sharedStyles.modalSection} aria-label="Quote handoff">
          <h3 className={sharedStyles.modalSectionTitle}>Next: customer quote</h3>
          <p className={styles.detail}>{ui.quoteDetail}</p>
          {ui.quoteBlockedDetail ? <p className={styles.blockedNote}>{ui.quoteBlockedDetail}</p> : null}
        </section>
      </div>

      <div className={`${sharedStyles.modalFooter} ${styles.actions}`}>
        <button type="button" className={sharedStyles.modalButtonSecondary} onClick={onDismiss}>
          Stay in calculator
        </button>
        <button type="button" className={sharedStyles.modalButtonSecondary} onClick={() => navigate(routes.project)}>
          Back to project
        </button>
        <button
          type="button"
          className={sharedStyles.modalButtonPrimary}
          onClick={() => navigate(routes.quote)}
          disabled={ui.quoteDisabled}
        >
          Create quote from this design
        </button>
      </div>
    </Modal>
  );
}
