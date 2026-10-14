'use client';
import { useConfiguratorPrice } from '../../components/configurator-prototype/useConfiguratorPrice';
import { formatEstimate } from '../../lib/estimateDisplay';
import type { LandingDesign } from './landingDesign.server';
import { useLandingPrice, type LandingSelectionState } from './useLandingPrice';
import type { LandingDisplayPrice } from '../../lib/landingPriceTable';
import styles from './landing-selector.module.css';

function EstimateView({ price, retry, className, retryOptions }: { price: LandingDisplayPrice | null; retry: () => void; className: string; retryOptions?: () => void }) {
  const amount = price?.status === 'priced' ? price.amountIncGst : null;
  return <div className={className || styles.estimate} data-estimate-state={price?.status ?? 'loading'} aria-live="polite" aria-atomic="true">
    <span>Initial installed estimate</span>
    <strong>{price?.status === 'issue' ? 'Check the projection' : amount !== null ? formatEstimate(amount) : price?.status === 'custom' ? 'Tailored quote' : !price ? 'Updating estimate…' : 'Estimate unavailable'}</strong>
    <p>{amount !== null ? 'NZD · Including GST · Subject to site confirmation' : price?.status === 'custom' ? 'We can review this size and confirm the cost for your site.' : 'You can still enquire. We’ll confirm the cost for your site.'}</p>
    <div className={styles.retrySlot}>{retryOptions ? <button type="button" onClick={retryOptions}>Retry options</button> : price && ['disabled', 'unavailable'].includes(price.status) && <button type="button" onClick={retry}>Retry estimate</button>}</div>
  </div>;
}

function CanonicalEstimate({ design, className, retryTable }: { design: LandingDesign; className: string; retryTable: () => void }) {
  const { price, retry } = useConfiguratorPrice(design.draft, !design.issue);
  return <EstimateView price={design.issue ? { status: 'issue' } : price} className={className} retry={() => { retry(); retryTable(); }} />;
}

export default function LandingEstimate({ state, className = '' }: { state: LandingSelectionState; className?: string }) {
  const table = useLandingPrice(state);
  if (table.price) return <EstimateView price={table.price} retry={table.retry} className={className} retryOptions={state.failed ? state.retry : undefined} />;
  // A fresh child mount prevents an earlier canonical reply reappearing after a table lease is revoked/expired.
  if (state.design) return <CanonicalEstimate key={`${table.epoch}:${JSON.stringify(state.design.draft)}`} design={state.design} className={className} retryTable={table.retry} />;
  return <div className={className || styles.estimate} data-estimate-state={state.failed ? 'unavailable' : 'loading'} aria-live="polite" aria-atomic="true">
    <span>Initial installed estimate</span><strong>{state.failed ? 'Options unavailable' : 'Preparing your options…'}</strong>
    <p>You can still enquire. We’ll confirm the cost for your site.</p>
    <div className={styles.retrySlot}>{state.failed && <button type="button" onClick={() => { state.retry(); table.retry(); }}>Retry options</button>}</div>
  </div>;
}
