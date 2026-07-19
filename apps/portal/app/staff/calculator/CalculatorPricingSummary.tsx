'use client';

import {
  calculatorResultFreshnessLabel,
  type CalculatorResultFreshness,
} from './calculatorResultFreshness';
import { calculateStaffCustomerPriceFromCostEx } from '@/lib/quotes/pricing';
import styles from './CalculatorPricingSummary.module.css';

export type CalculatorPricingSummaryProps = {
  variant?: 'full' | 'compact';
  resultFreshness: CalculatorResultFreshness;
  issuesCount: number;
  onOpenIssues: () => void;
  internalTrueCostExGst?: number;
  internalTrueCostIncGst?: number;
  materialsExGst?: number;
  installExGst?: number;
  overheadExGst?: number;
  crewHours?: number;
  installDays?: number;
  blindCustomerPriceExGst?: number;
  blindCustomerPriceIncGst?: number;
  hasInfills: boolean;
};

function formatMoney(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

const customerPriceNumberFormatter = new Intl.NumberFormat('en-NZ', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCustomerPrice(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `$${customerPriceNumberFormatter.format(Math.round(value))}`;
}

function formatNumber(value: number | undefined, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric} data-pricing-metric>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function CalculatorPricingSummary({
  variant = 'full',
  resultFreshness,
  issuesCount,
  onOpenIssues,
  internalTrueCostExGst,
  internalTrueCostIncGst,
  materialsExGst,
  installExGst,
  overheadExGst,
  crewHours,
  installDays,
  blindCustomerPriceExGst,
  blindCustomerPriceIncGst,
  hasInfills,
}: CalculatorPricingSummaryProps) {
  const customerPrice = calculateStaffCustomerPriceFromCostEx(internalTrueCostExGst);
  const isLastValid = resultFreshness !== 'current' && customerPrice !== null;
  const customerPriceLabel = isLastValid
    ? 'Last valid customer price (inc GST)'
    : 'Customer price (inc GST)';
  const hasBlindPricing = [blindCustomerPriceExGst, blindCustomerPriceIncGst].some(
    (value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) >= 0.005,
  );

  if (variant === 'compact') {
    return (
      <section
        className={isLastValid ? `${styles.compactSummary} ${styles.compactSummaryStale}` : styles.compactSummary}
        aria-label="Current customer price"
        data-pricing-summary-variant="compact"
        data-result-freshness={resultFreshness}
      >
        <div className={styles.compactPrice}>
          <span className={styles.compactLabel}>{customerPriceLabel}</span>
          <strong className={styles.compactValue}>{formatCustomerPrice(customerPrice?.incGst)}</strong>
        </div>
        <div className={styles.compactMeta}>
          <span>Ex GST {formatCustomerPrice(customerPrice?.exGst)}</span>
          <span>{calculatorResultFreshnessLabel(resultFreshness)}</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={isLastValid ? `${styles.summary} ${styles.summaryStale}` : styles.summary}
      aria-label="Pricing preview"
      data-pricing-summary-variant="full"
      data-result-freshness={resultFreshness}
    >
      <header className={styles.header}>
        <div>
          <h2>Pricing preview</h2>
          <p>{calculatorResultFreshnessLabel(resultFreshness)}</p>
        </div>
        {issuesCount > 0 ? (
          <button type="button" className={styles.issueButton} onClick={onOpenIssues}>
            Errors ({issuesCount})
          </button>
        ) : null}
      </header>

      <div className={styles.hero}>
        <span className={styles.heroLabel}>{customerPriceLabel}</span>
        <strong className={styles.heroValue}>{formatCustomerPrice(customerPrice?.incGst)}</strong>
        <span className={styles.heroEx}>Customer price (ex GST) {formatCustomerPrice(customerPrice?.exGst)}</span>
        <span className={styles.heroExplanation}>1.25× internal true cost · pergola only</span>
      </div>

      <div className={styles.internalSection}>
        <h3>Internal costing</h3>
        <dl className={styles.internalGrid} data-pricing-metric-layout="inline">
          <Metric label="True cost (ex GST)" value={formatMoney(internalTrueCostExGst)} />
          <Metric label="True cost (inc GST)" value={formatMoney(internalTrueCostIncGst)} />
          <Metric label="Materials" value={formatMoney(materialsExGst)} />
          <Metric label="Install payout" value={formatMoney(installExGst)} />
          <Metric label="Overhead" value={formatMoney(overheadExGst)} />
          <Metric label="Crew hours" value={formatNumber(crewHours)} />
          <Metric label="Install days" value={formatNumber(installDays, 0)} />
        </dl>
      </div>

      <div className={styles.addonsSection}>
        <h3>Customer quote add-ons</h3>
        {hasBlindPricing || hasInfills ? (
          <dl className={styles.addonsGrid} data-pricing-metric-layout="inline">
            {hasBlindPricing ? (
              <>
                <Metric label="Blind customer price (ex GST)" value={formatMoney(blindCustomerPriceExGst)} />
                <Metric label="Blind customer price (inc GST)" value={formatMoney(blindCustomerPriceIncGst)} />
              </>
            ) : null}
            {hasInfills ? <Metric label="Infills" value="Configured (see BOM)" /> : null}
          </dl>
        ) : (
          <p className={styles.addonsEmpty}>No customer-priced add-ons configured.</p>
        )}
        {hasBlindPricing ? <p>Blind prices are added during quote creation and are excluded from pergola true cost.</p> : null}
      </div>
    </section>
  );
}
