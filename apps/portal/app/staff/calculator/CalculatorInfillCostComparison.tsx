'use client';

import styles from './CalculatorGrid.module.css';
import type { CalculatorInfillCostComparison as InfillCostComparisonModel } from './useCalculatorInfillCostComparison';

function formatSignedMoney(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.005) return '$0.00';
  const sign = value > 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.previewRow}>
      <span className={styles.previewRowLabel}>{label}</span>
      <span className={styles.previewRowValue}>{value}</span>
    </div>
  );
}

export default function CalculatorInfillCostComparison({
  comparison,
  onApply,
}: {
  comparison: InfillCostComparisonModel;
  onApply: (source: 'sheet_panels' | 'strip_620') => void;
}) {
  return (
    <div className={styles.infillComputedGroup}>
      <div className={styles.infillComputedGroupTitle}>Cost comparison</div>
      {comparison.moduleBaselineLoading ? (
        <p className={styles.infillComputedNote}>Loading module baseline...</p>
      ) : null}
      {comparison.moduleBaselineError ? <p className={styles.previewError}>{comparison.moduleBaselineError}</p> : null}
      {comparison.optionLoading ? <p className={styles.infillComputedNote}>Running option comparison...</p> : null}
      {comparison.optionError ? <p className={styles.previewError}>{comparison.optionError}</p> : null}
      <div className={styles.infillDecisionCard}>
        <div className={styles.infillDecisionTitle}>Marginal cost (this infill)</div>
        <CostRow label="Delta total (ex-GST)" value={formatSignedMoney(comparison.marginalDelta?.total_ex)} />
        <CostRow label="Delta total (inc-GST)" value={formatSignedMoney(comparison.marginalDelta?.total_inc)} />
        <CostRow label="Delta materials (ex-GST)" value={formatSignedMoney(comparison.marginalDelta?.materials_ex)} />
        <CostRow label="Delta install (ex-GST)" value={formatSignedMoney(comparison.marginalDelta?.install_ex)} />
        <p className={styles.infillComputedNote}>Marginal vs current module; pooling across job not represented.</p>
      </div>
      <div className={styles.infillDecisionCard}>
        <div className={styles.infillDecisionTitle}>Compare sheet vs 620 strips</div>
        <div className={styles.infillDecisionRow}>
          <div className={styles.infillDecisionMain}>
            <div className={styles.infillDecisionLabel}>Sheet panels</div>
            <div className={styles.infillDecisionMeta}>
              {`Delta total ${formatSignedMoney(comparison.sheetDelta?.total_ex)} | Delta materials ${formatSignedMoney(comparison.sheetDelta?.materials_ex)} | Delta install ${formatSignedMoney(comparison.sheetDelta?.install_ex)}`}
            </div>
            <div className={styles.infillDecisionMeta}>
              {`Complexity: panels ~${comparison.sheetComplexityEstimate?.panelCountTotal ?? '—'}, 50x50 ~${comparison.sheetComplexityEstimate?.estimatedMullionsTotal ?? '—'}`}
            </div>
          </div>
          <button
            type="button"
            className={styles.infillDecisionApply}
            onClick={() => onApply('sheet_panels')}
          >
            Apply
          </button>
        </div>
        <div className={styles.infillDecisionRow}>
          <div className={styles.infillDecisionMain}>
            <div className={styles.infillDecisionLabel}>620 strips</div>
            <div className={styles.infillDecisionMeta}>
              {`Delta total ${formatSignedMoney(comparison.stripDelta?.total_ex)} | Delta materials ${formatSignedMoney(comparison.stripDelta?.materials_ex)} | Delta install ${formatSignedMoney(comparison.stripDelta?.install_ex)}`}
            </div>
            <div className={styles.infillDecisionMeta}>
              {`Complexity: panels ~${comparison.stripComplexityEstimate?.panelCountTotal ?? '—'}, 50x50 ~${comparison.stripComplexityEstimate?.estimatedMullionsTotal ?? '—'}`}
            </div>
          </div>
          <button
            type="button"
            className={styles.infillDecisionApply}
            onClick={() => onApply('strip_620')}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
