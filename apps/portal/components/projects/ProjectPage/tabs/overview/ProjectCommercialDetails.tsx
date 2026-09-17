import type { ReactNode } from 'react';
import type { ProjectCommandCentreCurrentDesign } from '@/lib/projects/commandCentre/types';
import styles from './ProjectCommercialDetails.module.css';

export default function ProjectCommercialDetails({ data, children }: { data: ProjectCommandCentreCurrentDesign; children: ReactNode }) {
  // Simplify ordinary facts, never conceal a commercial exception behind a total.
  if (data.warnings.length || data.quote?.deliveryState === 'failed' || data.latestDeclinedQuote || data.estimate?.costingState === 'may_be_stale') return <>{children}</>;
  const cents = data.price.totalIncGstCents;
  const label = data.source === 'accepted_quote' ? 'Agreed price' : data.source === 'sent_quote' ? 'Proposed price' : data.source === 'draft_quote' ? 'Draft quote' : 'Current estimate';
  return <details className={styles.details}>
    <summary>
      <span>{cents == null ? (data.source === 'none' ? 'No price prepared yet' : `${label} unavailable`) : `${label}: ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 }).format(cents / 100)} inc GST`}</span>
      <span className={styles.hint}>Quote, design & payment details</span>
    </summary>
    <div className={styles.content}>{children}</div>
  </details>;
}
