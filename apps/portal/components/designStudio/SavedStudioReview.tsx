import StudioDesignHeading from './StudioDesignHeading';
import type { ReactNode } from 'react';
import Link from 'next/link';
import type { SavedEstimateReview, SavedReviewPrice } from '../../lib/designStudio/savedReview';
import styles from './SavedStudioReview.module.css';
import StudioWebsiteBrief from './StudioWebsiteBrief';

export type SavedStudioReviewProps = {
  review: SavedEstimateReview;
  projectId: string;
  editHref?: string;
  revisionHref?: string;
  importHref?: string;
  children?: ReactNode;
  calculation?: ReactNode;
  currentPriceContent?: ReactNode;
  reviewContent?: ReactNode;
  actualCosts?: ReactNode;
};

const currency = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' });
const cents = (value: number) => currency.format(value / 100);
const estimateLabel = (value: string) => /^estimate\b/i.test(value.trim()) ? value.trim() : `Estimate ${value}`;

function Price({ price, label }: { price: SavedReviewPrice; label: string }) {
  if (price.state === 'unavailable') return <p className={styles.unavailable}>{price.reason}</p>;
  return <>
    <p className={styles.amount} aria-label={`${label}: ${cents(price.totalIncGstCents)} NZD including GST`}>{cents(price.totalIncGstCents)}</p>
    <p className={styles.caption}>NZD including GST</p>
    <div className={styles.tableWrap}>
      <table className={styles.lines}>
        <caption className={styles.srOnly}>{label} — saved line totals including GST</caption>
        <thead><tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Total</th></tr></thead>
        <tbody>{price.lineItems.map((line, index) => <tr key={index}>
          <td>{line.description}</td><td>{line.qty}</td><td>{cents(line.lineTotalIncGstCents)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}

/** Present only the server-authorised review DTO; never derive or refresh pricing here. */
export default function SavedStudioReview({ review, projectId, editHref, revisionHref, importHref, children, calculation, currentPriceContent, reviewContent, actualCosts }: SavedStudioReviewProps) {
  const { estimate, studio, quote, sourceEstimate, internalCosts, nextAction } = review;
  const actionHref = nextAction.kind === 'edit' ? editHref : nextAction.kind === 'create-revision' ? revisionHref : undefined;
  return <main className={styles.review}>
    <Link className={styles.back} href={`/staff/projects/${encodeURIComponent(projectId)}?tab=estimates`}>← Back to project</Link>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>{estimate.commercialScopeKind === 'add_on' ? 'Add-on scope' : 'Base scope'} · Saved review</p>
        <StudioDesignHeading identity={review.identity} versionLabel={estimate.versionLabel}/>
        <p className={styles.subtitle}>{estimate.status === 'archived' ? 'Archived estimate' : 'Saved estimate'}{estimate.lock.isLocked ? ' · Locked' : ''}</p>
      </div>
      <div className={styles.action}>
        {importHref ? <Link className={styles.actionLink} href={importHref}>Import into Studio</Link> : actionHref ? <Link className={styles.actionLink} href={actionHref}>{nextAction.label}</Link> : <p>{nextAction.kind === 'edit' ? 'Editing is not connected here yet.' : nextAction.kind === 'create-revision' ? 'A new revision is needed to make changes. Revision creation is not connected here yet.' : 'Changes are unavailable for this saved version.'}</p>}
        {nextAction.reason && <p className={styles.caption}>{nextAction.reason}</p>}
      </div>
    </header>
    {children && <div className={styles.design}>{children}</div>}
    {review.websiteBrief && <StudioWebsiteBrief brief={review.websiteBrief} />}
    <div className={styles.grid}>
      {currentPriceContent ?? <section className={styles.current} aria-label="Current estimate price">
        <p className={styles.eyebrow}>Current estimate · {estimate.versionLabel}</p>
        <h2>{review.currentPrice.state === 'available' ? 'Saved estimate price' : studio.state === 'unpriced' ? 'Unpriced design' : 'Price unavailable'}</h2>
        <Price price={review.currentPrice} label="Current estimate price" />
        {review.currentPrice.state === 'available' && <p className={styles.caption}>{review.currentPrice.basis === 'configured-frozen' ? 'Frozen configured price saved with this estimate.' : 'Selling breakdown from this saved estimate.'}</p>}
      </section>}
      <div className={styles.references}>
        {calculation}
        {quote && <section className={styles.card} aria-label="Saved quote version">
          <p className={styles.eyebrow}>{quote.immutable ? 'Frozen quote version' : 'Saved draft quote'}</p>
          <h2>{quote.quoteRef} · Version {quote.versionNumber}</h2>
          <p className={styles.subtitle}>{quote.status.charAt(0) + quote.status.slice(1).toLowerCase()} · From {estimateLabel(quote.sourceEstimateVersionLabel)}</p>
          <Price price={quote.price} label="Saved quote total" />
          {quote.price.state === 'available' && <p className={styles.caption}>{quote.immutable ? 'These are the exact saved quote totals. Changes to the design do not change this version.' : 'These totals belong to this saved draft quote.'}</p>}
        </section>}
        {sourceEstimate && <section className={styles.card} aria-label="Original estimate reference">
          <p className={styles.eyebrow}>Reference only</p>
          <h2>Original estimate{sourceEstimate.versionLabel ? ` · ${sourceEstimate.versionLabel}` : ''}</h2>
          <p className={styles.subtitle}>This price belongs to the original estimate, before the current design changes.</p>
          <Price price={sourceEstimate.price} label="Original estimate reference price" />
        </section>}
      </div>
    </div>
    {reviewContent}
    {actualCosts}
    {internalCosts && <details className={styles.costs}>
      <summary>Internal costs · original source</summary>
      <p className={styles.caption}>Retained source costs in NZD excluding GST. These are not a price for the current design changes.</p>
      <dl>{([['Materials', internalCosts.materialsExGst], ['Installation', internalCosts.installExGst], ['Overhead', internalCosts.overheadExGst], ['Total cost', internalCosts.totalExGst]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === null ? 'Unavailable' : currency.format(value)}</dd></div>)}</dl>
    </details>}
  </main>;
}
