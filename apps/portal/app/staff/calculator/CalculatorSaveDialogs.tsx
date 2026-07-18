import type { DesignRequestPriorityTier } from '@/lib/designPackages/types';
import Modal from '@/components/ui/modal/Modal';
import styles from './CalculatorGrid.module.css';
import dialogStyles from './CalculatorSaveDialogs.module.css';
import { formatDesignRequestTierLabel } from './calculatorSaveWorkflow';
import {
  formatCalculatorCostMoney,
  type CalculatorPricingComparison,
} from './calculatorPricingComparison';
import type { UiWarning } from './warnings';

export type CalculatorIssue = {
  moduleIndex: number;
  fieldId: string;
  label: string;
  message: string;
};

export type SaveDialogSummary = {
  modules: string;
  activeModule: string;
  roofSize: string;
  roofMaterial: string;
  roofPitch: string;
  materialsEx: string;
  installEx: string;
  overheadEx: string;
  trueCostEx: string;
  blindCustomerEx: string;
};

type WarningGroups = {
  uiWarnings: UiWarning[];
  criticalUiWarnings: UiWarning[];
  reviewUiWarnings: UiWarning[];
  infoUiWarnings: UiWarning[];
};

type SaveConfirmationContentProps = {
  isEditingDesign: boolean;
  summary: SaveDialogSummary;
  pricingComparison: CalculatorPricingComparison | null;
  warnings: WarningGroups;
  confirmAcknowledgeWarnings: boolean;
  confirmRequestDesign: boolean;
  confirmRequestDesignPriority: DesignRequestPriorityTier;
  generateError: string | null;
  isGenerating: boolean;
  hasStatusBlockers: boolean;
  hasResult: boolean;
  onConfirmAcknowledgeWarningsChange: (checked: boolean) => void;
  onConfirmRequestDesignChange: (checked: boolean) => void;
  onConfirmRequestDesignPriorityChange: (tier: DesignRequestPriorityTier) => void;
  onCancel: () => void;
  onSave: () => void;
  onRepriceLatest: () => void;
};

export function IssuesDialogContent({
  issues,
  onClose,
  onIssueClick,
}: {
  issues: CalculatorIssue[];
  onClose: () => void;
  onIssueClick: (issue: CalculatorIssue) => void;
}) {
  return (
    <>
      <div className={styles.modalHeader}>
        <div>
          <h2 className={styles.modalTitle}>Issues</h2>
          <p className={styles.modalSubtitle}>Click an item to jump to the missing field.</p>
        </div>
        <button type="button" className={styles.modalClose} onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.modalBody}>
        <section className={styles.modalSection} aria-label="Validation errors">
          <h3 className={styles.modalSectionTitle}>Errors</h3>
          {issues.length ? (
            <ul className={styles.issuesList}>
              {issues.map((issue) => (
                <li key={`${issue.moduleIndex}-${issue.fieldId}`}>
                  <button type="button" className={styles.issueRow} onClick={() => onIssueClick(issue)}>
                    <div className={styles.issueMain}>
                      <div className={styles.issueTitle}>{`Module ${issue.moduleIndex + 1} · ${issue.label}`}</div>
                      <div className={styles.issueMessage}>{issue.message}</div>
                    </div>
                    <span className={styles.issueJump}>Jump</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.modalNote}>No validation errors.</p>
          )}
        </section>
      </div>
    </>
  );
}

export function SaveConfirmationContent({
  isEditingDesign,
  summary,
  pricingComparison,
  warnings,
  confirmAcknowledgeWarnings,
  confirmRequestDesign,
  confirmRequestDesignPriority,
  generateError,
  isGenerating,
  hasStatusBlockers,
  hasResult,
  onConfirmAcknowledgeWarningsChange,
  onConfirmRequestDesignChange,
  onConfirmRequestDesignPriorityChange,
  onCancel,
  onSave,
  onRepriceLatest,
}: SaveConfirmationContentProps) {
  return (
    <>
      <div className={styles.modalHeader}>
        <div>
          <h2 className={styles.modalTitle}>{isEditingDesign ? 'Review costing before saving' : 'Save design'}</h2>
          <p className={styles.modalSubtitle}>
            {isEditingDesign
              ? 'Choose whether to keep the estimate’s stored costing basis or replace it with the Live calculator result.'
              : 'This will save the current design draft for this project.'}
          </p>
        </div>
        <button type="button" className={styles.modalClose} onClick={onCancel}>
          Close
        </button>
      </div>

      <div className={styles.modalBody}>
        <section className={styles.modalSection} aria-label="Inputs summary">
          <h3 className={styles.modalSectionTitle}>Inputs</h3>
          <div className={styles.modalGrid}>
            <SummaryMetric label="Modules" value={summary.modules} />
            <SummaryMetric label="Active module" value={summary.activeModule} />
            <SummaryMetric label="Roof length / roof span" value={summary.roofSize} />
            <SummaryMetric label="Roof material" value={summary.roofMaterial} />
            <SummaryMetric label="Roof pitch" value={summary.roofPitch} />
          </div>
        </section>

        {isEditingDesign && pricingComparison ? (
          <PricingComparisonSection comparison={pricingComparison} />
        ) : (
          <section className={styles.modalSection} aria-label="Costing summary">
            <h3 className={styles.modalSectionTitle}>Internal costing</h3>
            <div className={styles.modalGrid}>
              <SummaryMetric label="Materials (ex‑GST)" value={summary.materialsEx} />
              <SummaryMetric label="Install payout (ex‑GST)" value={summary.installEx} />
              <SummaryMetric label="Overhead (ex‑GST)" value={summary.overheadEx} />
              <SummaryMetric label="Internal true cost (ex‑GST)" value={summary.trueCostEx} />
            </div>
            <div className={dialogStyles.quoteAddonNote}>
              <span>Blind customer price (ex‑GST)</span>
              <strong>{summary.blindCustomerEx}</strong>
              <p>Added during quote creation and excluded from pergola true cost.</p>
            </div>
          </section>
        )}

        <section className={styles.modalSection} aria-label="Warnings">
          <h3 className={styles.modalSectionTitle}>Warnings</h3>
          {warnings.uiWarnings.length ? (
            <>
              {warnings.criticalUiWarnings.length ? (
                <WarningList title="Critical (blocks saving)" warnings={warnings.criticalUiWarnings} tone="critical" />
              ) : null}
              {warnings.reviewUiWarnings.length ? (
                <WarningList title="Review (acknowledge to continue)" warnings={warnings.reviewUiWarnings} />
              ) : null}
              {warnings.infoUiWarnings.length ? <WarningList title="Info" warnings={warnings.infoUiWarnings} /> : null}
            </>
          ) : (
            <p className={styles.modalNote}>No warnings for this design.</p>
          )}
        </section>

        {warnings.reviewUiWarnings.length ? (
          <label className={styles.modalCheckboxRow}>
            <input
              type="checkbox"
              checked={confirmAcknowledgeWarnings}
              onChange={(event) => onConfirmAcknowledgeWarningsChange(event.target.checked)}
            />
            <span>I acknowledge the review warnings</span>
          </label>
        ) : null}

        {!isEditingDesign ? (
          <>
            <label className={styles.modalCheckboxRow}>
              <input
                type="checkbox"
                checked={confirmRequestDesign}
                onChange={(event) => onConfirmRequestDesignChange(event.target.checked)}
              />
              <span>Request drafting after saving this design</span>
            </label>

            {confirmRequestDesign ? (
              <div className={styles.modalField}>
                <label htmlFor="calculatorDesignRequestPriority">Priority tier</label>
                <select
                  id="calculatorDesignRequestPriority"
                  className={styles.modalSelect}
                  value={confirmRequestDesignPriority}
                  onChange={(event) => onConfirmRequestDesignPriorityChange(event.target.value as DesignRequestPriorityTier)}
                >
                  {(['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'UNPRICED'] as const).map((tier) => (
                    <option key={tier} value={tier}>
                      {formatDesignRequestTierLabel(tier)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </>
        ) : null}

        {generateError ? <p className={styles.modalError}>{generateError}</p> : null}
      </div>

      <div className={styles.modalFooter}>
        <button type="button" className={styles.modalButtonSecondary} onClick={onCancel} disabled={isGenerating}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.modalButtonPrimary}
          disabled={
            warnings.criticalUiWarnings.length > 0 ||
            hasStatusBlockers ||
            (warnings.reviewUiWarnings.length > 0 && !confirmAcknowledgeWarnings) ||
            !hasResult ||
            isGenerating
          }
          onClick={onSave}
        >
          {isEditingDesign ? 'Save design — keep stored costing' : 'Save design'}
        </button>
        {isEditingDesign ? (
          <button
            type="button"
            className={styles.modalButtonSecondary}
            disabled={
              warnings.criticalUiWarnings.length > 0 ||
              hasStatusBlockers ||
              (warnings.reviewUiWarnings.length > 0 && !confirmAcknowledgeWarnings) ||
              !hasResult ||
              isGenerating
            }
            onClick={onRepriceLatest}
          >
            Reprice and save
          </button>
        ) : null}
      </div>
    </>
  );
}

const COMPARISON_ROWS: Array<{
  key: keyof NonNullable<CalculatorPricingComparison['live']>;
  label: string;
}> = [
  { key: 'materialsEx', label: 'Materials (ex‑GST)' },
  { key: 'installEx', label: 'Install payout (ex‑GST)' },
  { key: 'overheadEx', label: 'Overhead (ex‑GST)' },
  { key: 'trueCostEx', label: 'Internal true cost (ex‑GST)' },
  { key: 'trueCostInc', label: 'Internal true cost (inc‑GST)' },
];

function PricingComparisonSection({ comparison }: { comparison: CalculatorPricingComparison }) {
  const changeMessage = comparison.pricingInputsChanged
    ? 'Cost-affecting design inputs have changed.'
    : 'No cost-affecting design input changes were detected.';
  const stateMessage =
    comparison.storedPricingState === 'stale'
      ? 'The stored estimate already uses preserved costing from an earlier design change.'
      : comparison.storedPricingState === 'unknown'
        ? 'This estimate predates recorded costing freshness, so review the stored values carefully.'
        : null;

  return (
    <section className={styles.modalSection} aria-label="Stored and live costing comparison">
      <div className={dialogStyles.comparisonHeading}>
        <h3 className={styles.modalSectionTitle}>Internal true cost comparison</h3>
        <span className={comparison.pricingInputsChanged ? dialogStyles.changedPill : dialogStyles.unchangedPill}>
          {comparison.pricingInputsChanged ? 'Inputs changed' : 'Inputs unchanged'}
        </span>
      </div>
      <p className={dialogStyles.comparisonNote}>{changeMessage}</p>
      {stateMessage ? <p className={dialogStyles.staleNote}>{stateMessage}</p> : null}
      <div className={dialogStyles.comparisonTable} role="table" aria-label="Costing comparison">
        <div className={dialogStyles.comparisonHeader} role="row">
          <span role="columnheader">Cost item</span>
          <span role="columnheader">Stored estimate</span>
          <span role="columnheader">Live calculator</span>
          <span role="columnheader">Difference</span>
        </div>
        {COMPARISON_ROWS.map((row) => (
          <div className={dialogStyles.comparisonRow} role="row" key={row.key}>
            <span className={dialogStyles.comparisonLabel} role="rowheader">{row.label}</span>
            <span data-label="Stored estimate" role="cell">{formatCalculatorCostMoney(comparison.stored?.[row.key] ?? null)}</span>
            <span data-label="Live calculator" role="cell">{formatCalculatorCostMoney(comparison.live?.[row.key] ?? null)}</span>
            <span data-label="Difference" role="cell">{formatCalculatorCostMoney(comparison.difference?.[row.key] ?? null, { signed: true })}</span>
          </div>
        ))}
      </div>
      <div className={dialogStyles.decisionHelp}>
        <p><strong>Keep stored costing</strong> updates the design without replacing saved cost outputs.</p>
        <p><strong>Reprice and save</strong> replaces saved cost outputs with the Live calculator result.</p>
      </div>
    </section>
  );
}

export default function CalculatorSaveDialogs({
  issuesOpen,
  issues,
  onCloseIssues,
  onIssueClick,
  confirmOpen,
  onCloseConfirm,
  saveConfirmation,
}: {
  issuesOpen: boolean;
  issues: CalculatorIssue[];
  onCloseIssues: () => void;
  onIssueClick: (issue: CalculatorIssue) => void;
  confirmOpen: boolean;
  onCloseConfirm: () => void;
  saveConfirmation: Omit<SaveConfirmationContentProps, 'onCancel'>;
}) {
  return (
    <>
      {issuesOpen ? (
        <Modal
          open
          ariaLabel="Validation issues"
          onClose={onCloseIssues}
          overlayClassName={styles.modalOverlay}
          panelClassName={styles.modal}
          maxWidthPx={720}
        >
          <IssuesDialogContent issues={issues} onClose={onCloseIssues} onIssueClick={onIssueClick} />
        </Modal>
      ) : null}

      {confirmOpen ? (
        <Modal
          open
          ariaLabel={saveConfirmation.isEditingDesign ? 'Save design confirmation' : 'Save design confirmation'}
          onClose={onCloseConfirm}
          overlayClassName={styles.modalOverlay}
          panelClassName={styles.modal}
          maxWidthPx={720}
        >
          <SaveConfirmationContent {...saveConfirmation} onCancel={onCloseConfirm} />
        </Modal>
      ) : null}
    </>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className={styles.modalKey}>{label}</div>
      <div className={styles.modalVal}>{value}</div>
    </div>
  );
}

function WarningList({
  title,
  warnings,
  tone,
}: {
  title: string;
  warnings: UiWarning[];
  tone?: 'critical';
}) {
  return (
    <>
      <div className={styles.modalKey} style={tone === 'critical' ? { marginBottom: 6, color: 'rgb(185, 28, 28)' } : { marginTop: 10, marginBottom: 6 }}>
        {title}
      </div>
      <ul className={styles.modalWarnings}>
        {warnings.map((warning) => (
          <li key={warning.id}>{warning.message}</li>
        ))}
      </ul>
    </>
  );
}
