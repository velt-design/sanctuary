'use client';
import {useEffect,type ReactNode} from 'react';
import { SearchFilterBar } from '@/components/ui/foundation/SearchFilterBar';
import { Card, Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/foundation/FoundationSurfaces';
import { MetricGrid } from '@/components/ui/foundation/FoundationOperational';
import type { ProjectInvoiceSchedule } from '@/lib/invoices/types';
import type { EstimatesListBinding } from './EstimatesListSurface';
import styles from './InvoicesTab.module.css';
import ReadStatus from '@/components/page-state/ReadStatus';
export type InvoicesListEvidence = {
  pending?:boolean; closed: boolean; schedule: ProjectInvoiceSchedule | null; schedulePending: boolean; scheduleEyebrow: ReactNode;
  beforeSchedule: ReactNode; scheduleDetails: ReactNode; beforeHistory: ReactNode; historyEyebrow: ReactNode; noticeTitle?: string; noticeAction?: ReactNode;
  dialogs: ReactNode; render: (query: string) => { noMatches: ReactNode; rows: ReactNode };
};
export type InvoicesListBinding = Omit<EstimatesListBinding, 'publish'> & { publish: (value: InvoicesListEvidence | null) => void };
function formatMoneyFromCents(value: number): string {
  return Number.isFinite(value) ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(value / 100) : '-';
}

export function InvoiceScheduleTotalsSurface({ schedule, pending = false, closed = false }: { schedule: ProjectInvoiceSchedule | null; pending?: boolean; closed?: boolean }) {
  const unknown=pending?'Reading…':'Unavailable';
  return (
<MetricGrid
            ariaLabel="Accepted project quote payment totals"
            columns={4}
            items={[
              { label: closed ? 'Recorded contract value' : 'Job total', value: schedule?formatMoneyFromCents(schedule.billableTotalIncGstCents ?? schedule.acceptedQuoteTotalIncGstCents):unknown, detail: 'Accepted quotes and separate invoiced work' },
              ...((schedule?.standaloneTotalIncGstCents ?? 0) > 0 ? [
                { label: 'Accepted quote value', value: formatMoneyFromCents(schedule!.acceptedQuoteTotalIncGstCents), detail: 'Base contract and accepted add-ons' },
                { label: 'Other invoiced work', value: formatMoneyFromCents(schedule!.standaloneTotalIncGstCents ?? 0), detail: 'Separate charges outside current quotes' },
              ] : []),
              { label: 'Recorded payments', value: schedule?formatMoneyFromCents(schedule.paidIncGstCents):unknown, detail: schedule&&schedule.unallocatedCreditIncGstCents > 0 ? `${formatMoneyFromCents(schedule.unallocatedCreditIncGstCents)} unallocated credit` : 'Net project payment ledger' },
              { label: 'Open invoice balance', value: schedule?formatMoneyFromCents(schedule.outstandingIncGstCents):unknown, detail: 'Issued and unpaid; excludes work still to invoice' },
              { label: closed ? 'Uncovered contract value' : 'Still to invoice', value: schedule?formatMoneyFromCents(schedule.remainingToInvoiceIncGstCents):unknown, detail: closed ? 'A recorded difference, not an instruction to bill. Review the closure agreement.' : 'Agreed work not yet covered by payments or open invoices' },
            ]}
          />
  );
}

export default function InvoicesListSurface({ query, onQueryChange, evidence, unavailable = false, onInteraction }: {
  query: string; onQueryChange: (query: string) => void; evidence: InvoicesListEvidence | null; unavailable?: boolean; onInteraction?:()=>void;
}) {
  useEffect(()=>{if(evidence&&!evidence.pending||!onInteraction)return;const start=window.scrollY;const onScroll=()=>{if(window.scrollY!==start)onInteraction();};window.addEventListener('scroll',onScroll,{passive:true});return()=>window.removeEventListener('scroll',onScroll);},[evidence,onInteraction]);
  const content = evidence?.render(query);
  return <div className={styles.wrapper}>
    <div className={styles.header}><h3 className={styles.title}>Invoices</h3>
      <p className={styles.subtitle}>NZD inc GST · payment schedule, money received and invoice history.</p></div>
    <ReadStatus title={evidence?.noticeTitle ?? (unavailable ? 'Invoices unavailable' : !evidence || evidence.pending ? 'Reading invoices…' : 'Invoices current')}
      tone={unavailable ? 'error' : evidence?.noticeTitle ? 'warning' : 'neutral'} action={evidence?.noticeAction} details={evidence?.beforeSchedule} />
    <Card className={styles.paymentSchedule} title={evidence?.closed ? 'Recorded payment schedule' : 'Job payment schedule'}
      eyebrow={evidence?.scheduleEyebrow ?? (unavailable ? 'Payment position unavailable' : 'Reading payment position…')}
      padding="none" headingLevel={4} aria-label="Invoice schedule">
      <InvoiceScheduleTotalsSurface schedule={evidence?.schedule ?? null} pending={evidence ? evidence.schedulePending : !unavailable} closed={evidence?.closed} />
      {evidence?.scheduleDetails}
      {evidence?.beforeHistory}
    </Card>
    <Card title="Invoice history" eyebrow={evidence?.historyEyebrow ?? (unavailable ? 'Invoice count unavailable' : 'Reading invoices…')} padding="none" headingLevel={4}>
      <SearchFilterBar query={query} onQueryChange={onQueryChange} queryPlaceholder="Search invoice, quote or status" searchId="invoice-search" filters={[]} onClearAll={() => onQueryChange('')} />
      <Table aria-label="Invoices" className={styles.invoiceTable} viewportClassName={styles.listViewport}>
        <colgroup>{[20, 18, 18, 14, 16, 14].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
        <TableHeader><TableRow>
        <TableHead>Invoice</TableHead><TableHead>Quote</TableHead><TableHead>Amount inc GST</TableHead><TableHead>Due</TableHead><TableHead>Delivery</TableHead><TableHead>Actions</TableHead>
      </TableRow></TableHeader><TableBody>{content?.noMatches ? <TableRow><TableCell colSpan={6}>{content.noMatches}</TableCell></TableRow> : null}{content ? content.rows : <TableRow><TableCell colSpan={6}><span role={unavailable ? undefined : 'status'}>{unavailable ? 'Invoices unavailable. Retry the read.' : 'Reading invoices…'}</span></TableCell></TableRow>}</TableBody></Table>
    </Card>
    {evidence?.dialogs}
  </div>;
}
