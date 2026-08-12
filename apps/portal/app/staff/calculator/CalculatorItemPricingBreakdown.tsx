import type { CalculatorPricingPreview } from './calculatorPricingPreview';
import styles from './CalculatorItemPricingBreakdown.module.css';

function moneyFromCents(cents: number): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const TYPE_LABELS: Record<CalculatorPricingPreview['rows'][number]['kind'], string> = {
  pergola: 'Pergola',
  module: 'Module',
  infill: 'Infill',
  shared: 'Site',
  approval: 'Approval',
  blind: 'Blind',
  lighting: 'Lighting',
};

function InternalTrueCost({
  costs,
}: {
  costs: NonNullable<CalculatorPricingPreview['rows'][number]['internalTrueCost']>;
}) {
  return (
    <details className={styles.internalDetails}>
      <summary>Internal incremental cost</summary>
      <dl>
        <div>
          <dt>Materials ex GST</dt>
          <dd>{moneyFromCents(costs.materialsExGstCents)}</dd>
        </div>
        <div>
          <dt>Labour ex GST</dt>
          <dd>{moneyFromCents(costs.labourExGstCents)}</dd>
        </div>
        <div>
          <dt>Overhead ex GST</dt>
          <dd>{moneyFromCents(costs.overheadExGstCents)}</dd>
        </div>
        <div>
          <dt>Total incremental cost ex GST</dt>
          <dd>{moneyFromCents(costs.totalExGstCents)}</dd>
        </div>
      </dl>
    </details>
  );
}

export default function CalculatorItemPricingBreakdown({
  preview,
  canViewInternalCosts = false,
}: {
  preview: CalculatorPricingPreview;
  canViewInternalCosts?: boolean;
}) {
  if (!preview.rows.length) return null;

  return (
    <section
      className={styles.card}
      aria-label="Price by item"
      data-customer-total-inc-gst-cents={preview.totalIncGstCents}
    >
      <header className={styles.header}>
        <div>
          <h2>Price by item</h2>
          <p>
            Customer prices include GST
            {preview.discountPct > 0 ? `; ${preview.discountPct}% discount applies to pergola and site prices only` : ''}.
            {' '}Indented module allocations reconcile to their pergola total. Module infills are included within their pergola; existing-pergola add-ons are priced separately.
          </p>
        </div>
      </header>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Type</th>
              <th>Customer price</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr
                key={row.id}
                className={
                  row.kind === 'infill' && row.status === 'included'
                    ? styles.nestedIncludedRow
                    : row.kind === 'module'
                      ? styles.includedRow
                    : row.kind === 'shared'
                      ? styles.sharedRow
                      : undefined
                }
                data-parent-price-row={row.parentId}
              >
                <th>
                  <span className={styles.itemLabel}>{row.label}</span>
                  <span className={styles.itemDetail}>{row.detail}</span>
                  {canViewInternalCosts && row.internalTrueCost
                    ? <InternalTrueCost costs={row.internalTrueCost} />
                    : null}
                </th>
                <td>{TYPE_LABELS[row.kind]}</td>
                <td className={row.status === 'unpriced' ? styles.unpricedValue : undefined}>
                  {row.status === 'included'
                    ? row.priceIncGstCents === null
                      ? 'Included in pergola price'
                      : (
                          <span className={styles.includedContribution}>
                            <strong>{moneyFromCents(row.priceIncGstCents)}</strong>
                            <span>{row.kind === 'module' ? 'allocated module price' : 'included in module price'}</span>
                          </span>
                        )
                    : row.status === 'unpriced'
                      ? 'Not priced'
                      : moneyFromCents(row.priceIncGstCents ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={2}>{preview.unpricedItemCount > 0 ? 'Priced items total' : 'Customer total'}</th>
              <th>{moneyFromCents(preview.totalIncGstCents)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
