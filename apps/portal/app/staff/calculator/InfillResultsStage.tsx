import type { ReactNode } from 'react';

import styles from './CalculatorGrid.module.css';
import InfillCutList from './InfillCutList';
import type { CutListRow, InfillComputeStatus, InfillWarningItem } from './infillCompute';

type InfillResultPresentation = {
  tone: 'ready' | 'needs_details' | 'blocked';
  title: string;
  message: string;
};

type InfillResultsStageProps = {
  status: InfillResultPresentation;
  blockers: InfillWarningItem[];
  materialLabel: string;
  orientationLabel: string;
  additionalSupportCount: number;
  additionalSupportSummary: string;
  cutListStatus: InfillComputeStatus;
  cutListRows: CutListRow[];
  preview: ReactNode;
  technicalDetails: ReactNode;
  technicalDetailsOpen: boolean;
  onTechnicalDetailsToggle: (open: boolean) => void;
  onFixBlocker: (warning: InfillWarningItem) => void;
};

export default function InfillResultsStage({
  status,
  blockers,
  materialLabel,
  orientationLabel,
  additionalSupportCount,
  additionalSupportSummary,
  cutListStatus,
  cutListRows,
  preview,
  technicalDetails,
  technicalDetailsOpen,
  onTechnicalDetailsToggle,
  onFixBlocker,
}: InfillResultsStageProps) {
  const bannerToneClass =
    status.tone === 'blocked'
      ? styles.infillResultBannerBlocked
      : status.tone === 'needs_details'
        ? styles.infillResultBannerNeedsDetails
        : styles.infillResultBannerReady;

  return (
    <div className={styles.infillResultsStage}>
      <div className={`${styles.infillResultBanner} ${bannerToneClass}`} role="status">
        <strong>{status.title}</strong>
        <span>{status.message}</span>
      </div>

      {blockers.length ? (
        <ul className={styles.infillWarningList}>
          {blockers.map((warning) => (
            <li key={warning.id}>
              <button type="button" className={styles.infillWarningButton} onClick={() => onFixBlocker(warning)}>
                <span>{warning.message}</span>
                <span className={styles.infillWarningJump}>Fix details</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <aside id="infill-summary-panel" className={styles.infillEditorSummary}>
        <section className={styles.infillComputedPanel} aria-label="Computed infill summary">
          <div className={styles.infillResultsProductionSummary}>
            <div className={styles.infillChosenSystem}>
              <div><span>Panel material</span><strong>{materialLabel}</strong></div>
              <div><span>Joiner direction</span><strong>{orientationLabel}</strong></div>
              <div><span>Additional supports</span><strong>{additionalSupportCount}</strong></div>
            </div>
            <p className={styles.infillComputedNote}>{additionalSupportSummary}</p>
          </div>

          <InfillCutList status={cutListStatus} rows={cutListRows} />

          <section className={styles.infillResultsDiagram} aria-labelledby="infill-cutting-diagram-heading">
            <h4 id="infill-cutting-diagram-heading" className={styles.infillComputedTitle}>Cutting diagram</h4>
            {preview}
          </section>

          <details
            className={styles.infillCostDetails}
            open={technicalDetailsOpen}
            onToggle={(event) => onTechnicalDetailsToggle((event.currentTarget as HTMLDetailsElement).open)}
          >
            <summary>Cost and technical details</summary>
            {technicalDetails}
          </details>
        </section>
      </aside>
    </div>
  );
}
