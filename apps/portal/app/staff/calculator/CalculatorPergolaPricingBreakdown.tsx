import type { SiteOutputV1 } from '@sp/costing';
import { calculateStaffCustomerPriceFromCostEx, normalizeStaffQuoteDiscountPct } from '@/lib/quotes/pricing';
import styles from './CalculatorPergolaPricingBreakdown.module.css';

function money(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CalculatorPergolaPricingBreakdown({
  result,
  quoteDiscountPct,
}: {
  result: SiteOutputV1 | null;
  quoteDiscountPct: string | number;
}) {
  if (!result?.pergolas?.length) return null;
  const discountPct = normalizeStaffQuoteDiscountPct(quoteDiscountPct);
  const sharedCost = result.shared?.totals?.cost_ex_gst ?? 0;
  const sharedSell = calculateStaffCustomerPriceFromCostEx(sharedCost, discountPct)?.incGst ?? null;

  return (
    <section className={styles.card} aria-label="Price by pergola">
      <header className={styles.header}>
        <div>
          <h2>Price by pergola</h2>
          <p>Customer prices include GST{discountPct > 0 ? ` after ${discountPct}% discount` : ''}.</p>
        </div>
      </header>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Scope</th>
              <th>Modules</th>
              <th>True cost ex GST</th>
              <th>Customer price</th>
            </tr>
          </thead>
          <tbody>
            {result.pergolas.map((pergola, index) => {
              const trueCost = pergola.totals?.cost_ex_gst ?? null;
              const customerPrice = calculateStaffCustomerPriceFromCostEx(trueCost, discountPct)?.incGst ?? null;
              return (
                <tr key={pergola.id}>
                  <th>{pergola.label?.trim() || `Pergola ${index + 1}`}</th>
                  <td>{pergola.module_count}</td>
                  <td>{money(trueCost)}</td>
                  <td>{money(customerPrice)}</td>
                </tr>
              );
            })}
            {Math.abs(sharedCost) >= 0.005 ? (
              <tr className={styles.sharedRow}>
                <th>Shared site costs</th>
                <td>—</td>
                <td>{money(sharedCost)}</td>
                <td>{money(sharedSell)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
