import type { ReactNode } from 'react';
import type { ProjectCommandCentreCurrentDesign } from '@/lib/projects/commandCentre/types';
import styles from './ProjectCommercialDetails.module.css';
import { useProjectCommercialContext } from '../../ProjectCommercialContext';

export default function ProjectCommercialDetails({ data, pending = false, children }: { pending?: boolean; data: ProjectCommandCentreCurrentDesign | null; children: ReactNode }) {
  const { closed } = useProjectCommercialContext();
  // Simplify ordinary facts, never conceal a commercial exception behind a total.
  if (data && (data.warnings.length || data.quote?.deliveryState === 'failed' || data.latestDeclinedQuote || data.estimate?.costingState === 'may_be_stale')) return <>{children}</>;
  const cents = data?.price.totalIncGstCents;
  const label = !data ? 'Current price' : closed ? 'Recorded price' : data?.source === 'accepted_quote' ? 'Agreed price' : data?.source === 'sent_quote' ? 'Proposed price' : data?.source === 'draft_quote' ? 'Draft quote' : 'Current estimate';
  return <details className={styles.details}>
    <summary>
      <span className={styles.label}>{label}</span>
      <strong className={styles.price}>{!data ? (pending ? 'Reading price' : 'Price unavailable') : cents == null ? (data?.source === 'none' ? 'Not prepared' : 'Unavailable') : new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 }).format(cents / 100)}</strong>
      <span className={styles.hint}>{cents == null ? '' : 'NZD inc GST · '}Quote & design details</span>
    </summary>
    <div className={styles.content}>{children}</div>
  </details>;
}
