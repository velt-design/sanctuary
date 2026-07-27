'use client';

import type { InstallActionV1, MaterialsLineV1 } from '@sp/costing';

import { AlertBanner } from '@/components/ui/foundation/FoundationFeedback';
import styles from './CalculatorGrid.module.css';
import CalculatorMaterialsDebugPanel from './CalculatorMaterialsDebugPanel';
import type { CalculatorMaterialsDebugController } from './useCalculatorMaterialsDebug';
import type { UiWarning } from './warnings';

function formatMoney(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(2)}` : '--';
}

function formatNumber(value: number | undefined, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--';
}

type CalculatorStructureOutputRow = {
  label: string;
  value: string;
};

type CalculatorPreviewDetailsView = 'materials' | 'labour' | 'workings' | 'issues';

export type CalculatorPreviewDetailsProps = {
  view: CalculatorPreviewDetailsView;
  warnings: UiWarning[];
  onJumpToWarning: (warning: Extract<UiWarning, { source: 'infill' }>) => void;
  bomLines: MaterialsLineV1[];
  canViewInternalCosts: boolean;
  materialsEx: number | undefined;
  isAdvancedUi: boolean;
  materialsDebug: CalculatorMaterialsDebugController;
  labourActions: InstallActionV1[];
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
  bomLines,
  canViewInternalCosts,
  materialsEx,
  isAdvancedUi,
  materialsDebug,
}: Pick<
  CalculatorPreviewDetailsDataProps,
  'bomLines' | 'canViewInternalCosts' | 'materialsEx' | 'isAdvancedUi' | 'materialsDebug'
>) {
  return (
    <>
      <section className={styles.previewCard} aria-label="Materials breakdown">
        <h2 className={styles.previewCardTitle}>Materials breakdown</h2>
        <p className={styles.previewContext}>Whole job · showing up to 10 material lines</p>
        {bomLines.length ? (
          <div className={styles.previewTable}>
            {bomLines.map((line, index) => (
              <div key={`${line.id}-${line.label}-${index}`} className={styles.previewRow}>
                <div className={styles.previewRowMain}>
                  <div className={styles.previewRowLabel}>{line.label}</div>
                  <div className={styles.previewRowMeta}>
                    {formatNumber(line.qty)} {line.unit}
                  </div>
                </div>
                {canViewInternalCosts ? (
                  <div className={styles.previewRowValue}>{formatMoney(line.line_cost_ex_gst)}</div>
                ) : null}
              </div>
            ))}
            {canViewInternalCosts ? (
              <div className={styles.previewRowTotal}>
                <span>Total materials (ex-GST)</span>
                <span>{formatMoney(materialsEx)}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className={styles.previewMuted}>No materials yet.</p>
        )}
      </section>

      {isAdvancedUi && canViewInternalCosts ? (
        <CalculatorMaterialsDebugPanel controller={materialsDebug} />
      ) : null}
    </>
  );
}

function CalculatorLabourPanel({
  canViewInternalCosts,
  isAdvancedUi,
  labourActions,
}: Pick<CalculatorPreviewDetailsDataProps, 'canViewInternalCosts' | 'isAdvancedUi' | 'labourActions'>) {
  if (!canViewInternalCosts) {
    return (
      <section className={styles.previewCard} aria-label="Labour breakdown">
        <h2 className={styles.previewCardTitle}>Labour breakdown</h2>
        <p className={styles.previewMuted}>Detailed labour assumptions are available to administrators.</p>
      </section>
    );
  }

  if (!isAdvancedUi) {
    return (
      <section className={styles.previewCard} aria-label="Labour breakdown">
        <h2 className={styles.previewCardTitle}>Labour breakdown</h2>
        <p className={styles.previewMuted}>Switch the Calculator to Advanced to inspect labour assumptions.</p>
      </section>
    );
  }

  return (
    <section className={styles.previewCard} aria-label="Labour breakdown">
      <h2 className={styles.previewCardTitle}>Labour breakdown</h2>
      <p className={styles.previewContext}>Whole job · ordered by estimated time</p>
      {labourActions.length ? (
        <div className={styles.previewTable}>
          {labourActions.map((action) => (
            <div key={action.id} className={styles.previewRow}>
              <div className={styles.previewRowMain}>
                <div className={styles.previewRowLabel}>{action.label}</div>
                <div className={styles.previewRowMeta}>
                  {action.category} · {formatNumber(action.qty)} {action.unit}
                </div>
              </div>
              <div className={styles.previewRowValue}>{formatNumber(action.minutes, 0)} min</div>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.previewMuted}>No labour actions yet.</p>
      )}
    </section>
  );
}

function CalculatorWorkingsPanel({
  isAdvancedUi,
  structureRows,
}: Pick<CalculatorPreviewDetailsDataProps, 'isAdvancedUi' | 'structureRows'>) {
  if (!isAdvancedUi) {
    return (
      <section className={styles.previewCard} aria-label="Structure outputs">
        <h2 className={styles.previewCardTitle}>Calculated values</h2>
        <p className={styles.previewMuted}>Switch the Calculator to Advanced to inspect selected-module outputs.</p>
      </section>
    );
  }

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
