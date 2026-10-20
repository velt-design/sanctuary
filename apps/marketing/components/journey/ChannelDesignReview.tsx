'use client';
import { useConsent } from '../ConsentProvider';
import { trackChannelAction } from '../../lib/channelDesignTracking';

export default function ChannelDesignReview({ rows, className }: { rows: { label: string; value: string }[]; className?: string }) {
  const { consent, hasTrackingDecision } = useConsent();
  return <details className={className} onToggle={event => {
    if (event.currentTarget.open) trackChannelAction('design_review', hasTrackingDecision && consent.analytics);
  }}><summary>Review your design</summary><dl>{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
    <p>Your selected structure, roof, options and standard installation allowances. Foundations, unusual access or fixings, new electrical supply, travel and any engineering or consent are assessed separately.</p>
  </details>;
}
