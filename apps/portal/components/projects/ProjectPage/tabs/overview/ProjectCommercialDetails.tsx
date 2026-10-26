import type { ReactNode } from 'react';
import type { ProjectCommandCentreCurrentDesign } from '@/lib/projects/commandCentre/types';
import commercialStyles from './ProjectCommercialDetails.module.css';
import { useProjectCommercialContext } from '../../ProjectCommercialContext';
export default function ProjectCommercialDetails(props: { pending?: boolean; data: ProjectCommandCentreCurrentDesign | null; children: ReactNode }) { const {closed}=useProjectCommercialContext();return <ProjectCommercialDetailsSurface {...props} closed={closed}/>; }

function ProjectCommercialDetailsSurface({ data, pending = false, children, closed = false }: { pending?: boolean; data: ProjectCommandCentreCurrentDesign | null; children: ReactNode; closed?: boolean }) {
  // Simplify ordinary facts, never conceal a commercial exception behind a total.
  if (data && (data.warnings.length || data.quote?.deliveryState === 'failed' || data.latestDeclinedQuote || data.estimate?.costingState === 'may_be_stale')) return <>{children}</>;
  const cents = data?.price.totalIncGstCents;
  const label = !data ? 'Current price' : closed ? 'Recorded price' : data?.source === 'accepted_quote' ? 'Agreed price' : data?.source === 'sent_quote' ? 'Proposed price' : data?.source === 'draft_quote' ? 'Draft quote' : 'Current estimate';
  return <details className={commercialStyles.details}>
    <summary>
      <span className={commercialStyles.label}>{label}</span>
      <strong className={commercialStyles.price}>{!data ? (pending ? 'Reading price' : 'Price unavailable') : cents == null ? (data?.source === 'none' ? 'Not prepared' : 'Unavailable') : new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 }).format(cents / 100)}</strong>
      <span className={commercialStyles.hint}>{cents == null ? '' : 'NZD inc GST · '}Quote & design details</span>
    </summary>
    <div className={commercialStyles.content}>{children}</div>
  </details>;
}
