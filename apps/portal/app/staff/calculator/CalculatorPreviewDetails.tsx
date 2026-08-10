'use client';

import { AlertBanner } from '@/components/ui/foundation/FoundationFeedback';
import styles from './CalculatorGrid.module.css';
import CalculatorMaterialsDebugPanel from './CalculatorMaterialsDebugPanel';
import {
  CalculatorLabourBreakdown,
  CalculatorMaterialsBreakdown,
  type CalculatorLabourBreakdownProps,
  type CalculatorMaterialsBreakdownProps,
} from './CalculatorTrustedBreakdowns';
import type { CalculatorResultFreshness } from './calculatorResultFreshness';
import type { CalculatorMaterialsDebugController } from './useCalculatorMaterialsDebug';
import type { UiWarning } from './warnings';

type CalculatorStructureOutputRow = {
  label: string;
  value: string;
};

type CalculatorPreviewDetailsView = 'materials' | 'labour' | 'workings' | 'issues';

export type CalculatorPreviewDetailsProps = {
  view: CalculatorPreviewDetailsView;
  warnings: UiWarning[];
  onJumpToWarning: (warning: Extract<UiWarning, { source: 'infill' }>) => void;
  materialsBreakdown: CalculatorMaterialsBreakdownProps['breakdown'];
  canViewInternalCosts: boolean;
  materialsEx: number | undefined;
  materialsDebug: CalculatorMaterialsDebugController;
  labourBreakdown: CalculatorLabourBreakdownProps['breakdown'];
  resultFreshness: CalculatorResultFreshness;
  structureRows: CalculatorStructureOutputRow[];
};

type CalculatorPreviewDetailsDataProps = Omit<CalculatorPreviewDetailsProps, 'view'>;

function CalculatorIssuesPanel({
  warnings,
  onJumpToWarning,
}: Pick<CalculatorPreviewDetailsDataProps, 'warnings' | 'onJumpToWarning'>) {
  return (
    <section className={styles.previewCard} aria-label="Warnings">
      <h2 className={styles.previewCardTitle}>Warnings</h2>
      {warnings.length ? (
        <ul className={styles.warningList}>
          {warnings.map((warning) => (
            <li key={warning.id} className={styles.warningRow}>
              <AlertBanner
                tone={warning.severity === 'critical' ? 'blocking' : warning.severity === 'review' ? 'warning' : 'info'}
                title={warning.severity === 'critical' ? 'Critical' : warning.severity === 'review' ? 'Review' : 'Information'}
                action={warning.source === 'infill' ? (
                  <button
                    type="button"
                    className={styles.warningJumpButton}
                    onClick={() => onJumpToWarning(warning)}
                  >
                    Jump
                  </button>
                ) : undefined}
              >
                {warning.message}
              </AlertBanner>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.previewMuted}>No warnings yet.</p>
      )}
    </section>
  );
}

function CalculatorMaterialsPanel({
  materialsBreakdown,
  canViewInternalCosts,
  materialsEx,
  materialsDebug,
  resultFreshness,
}: Pick<
  CalculatorPreviewDetailsDataProps,
  | 'materialsBreakdown'
  | 'canViewInternalCosts'
  | 'materialsEx'
  | 'materialsDebug'
  | 'resultFreshness'
>) {
  return (
    <>
      <CalculatorMaterialsBreakdown
        breakdown={materialsBreakdown}
        canViewInternalCosts={canViewInternalCosts}
        materialsExGst={materialsEx}
        resultFreshness={resultFreshness}
      />

      {canViewInternalCosts ? (
        <details className={styles.adminDiagnostics} data-admin-diagnostics>
          <summary className={styles.adminDiagnosticsSummary}>Admin diagnostics</summary>
          <CalculatorMaterialsDebugPanel controller={materialsDebug} />
        </details>
      ) : null}
    </>
  );
}

function CalculatorLabourPanel({
  canViewInternalCosts,
  labourBreakdown,
  resultFreshness,
}: Pick<
  CalculatorPreviewDetailsDataProps,
  'canViewInternalCosts' | 'labourBreakdown' | 'resultFreshness'
>) {
  return (
    <CalculatorLabourBreakdown
      breakdown={labourBreakdown}
      canViewInternalCosts={canViewInternalCosts}
      resultFreshness={resultFreshness}
    />
  );
}

function CalculatorWorkingsPanel({
  structureRows,
}: Pick<CalculatorPreviewDetailsDataProps, 'structureRows'>) {
  return (
    <section className={styles.previewCard} aria-label="Structure outputs">
      <h2 className={styles.previewCardTitle}>Calculated values</h2>
      <p className={styles.previewContext}>Selected module · authoritative calculated outputs</p>
      <div className={styles.previewTable}>
        {structureRows.map((row) => (
          <div key={row.label} className={styles.previewRow}>
            <span className={styles.previewRowLabel}>{row.label}</span>
            <span className={styles.previewRowValue}>{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CalculatorPreviewDetails({
  view,
  ...props
}: CalculatorPreviewDetailsProps) {
  switch (view) {
    case 'materials':
      return <CalculatorMaterialsPanel {...props} />;
    case 'labour':
      return <CalculatorLabourPanel {...props} />;
    case 'workings':
      return <CalculatorWorkingsPanel {...props} />;
    case 'issues':
      return (
        <CalculatorIssuesPanel
          warnings={props.warnings}
          onJumpToWarning={props.onJumpToWarning}
        />
      );
    default:
      return null;
  }
}
