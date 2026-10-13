'use client';
import { useConfiguratorPrice } from '@/components/configurator-prototype/useConfiguratorPrice';
import { formatEstimate } from '@/lib/estimateDisplay';
import type { LandingDesign } from './landingDesign.server';
import styles from './landing-selector.module.css';

export default function LandingEstimate({ design, className = '' }: { design: LandingDesign; className?: string }) {
  const { price, retry } = useConfiguratorPrice(design.draft, !design.issue);
  const amount = !design.issue && price?.status === 'priced' ? price.amountIncGst : null;
  return <div className={className || styles.estimate} aria-live="polite" aria-atomic="true">
    <span>Initial installed estimate</span>
    <strong>{design.issue ? 'Check the projection' : amount !== null ? formatEstimate(amount) : price?.status === 'custom' ? 'Tailored quote' : !price ? 'Updating estimate…' : 'Estimate unavailable'}</strong>
    <p>{amount !== null ? 'NZD · Including GST · Subject to site confirmation' : price?.status === 'custom' ? 'We can review this size and confirm the cost for your site.' : 'You can still enquire. We’ll confirm the cost for your site.'}</p>
    <div className={styles.retrySlot}>{price && ['disabled', 'unavailable'].includes(price.status) && <button type="button" onClick={retry}>Retry estimate</button>}</div>
  </div>;
}
