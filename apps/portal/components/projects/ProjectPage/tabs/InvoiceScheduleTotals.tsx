import { MetricGrid } from '@/components/ui/foundation';
import type { ProjectInvoiceSchedule } from '@/lib/invoices/types';

function formatMoneyFromCents(value: number): string {
  return Number.isFinite(value) ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(value / 100) : '-';
}

/** Read-only presentation of the authoritative schedule; never sums quote versions. */
export default function InvoiceScheduleTotals({ schedule }: { schedule: ProjectInvoiceSchedule }) {
  return (
<MetricGrid
            ariaLabel="Accepted project quote payment totals"
            columns={4}
            items={[
              { label: 'Job total', value: formatMoneyFromCents(schedule.billableTotalIncGstCents ?? schedule.acceptedQuoteTotalIncGstCents), detail: 'Accepted quotes and issued standalone work' },
              ...((schedule.standaloneTotalIncGstCents ?? 0) > 0 ? [
                { label: 'Accepted quote value', value: formatMoneyFromCents(schedule.acceptedQuoteTotalIncGstCents), detail: 'Base contract and accepted add-ons' },
                { label: 'Standalone invoice value', value: formatMoneyFromCents(schedule.standaloneTotalIncGstCents ?? 0), detail: 'Issued, non-void standalone work' },
              ] : []),
              { label: 'Recorded payments', value: formatMoneyFromCents(schedule.paidIncGstCents), detail: schedule.unallocatedCreditIncGstCents > 0 ? `${formatMoneyFromCents(schedule.unallocatedCreditIncGstCents)} unallocated credit` : 'Net project payment ledger' },
              { label: 'Open invoice balance', value: formatMoneyFromCents(schedule.outstandingIncGstCents), detail: 'Issued and unpaid; excludes work still to invoice' },
              { label: 'Still to invoice', value: formatMoneyFromCents(schedule.remainingToInvoiceIncGstCents), detail: 'Agreed work not yet covered by payments or open invoices' },
            ]}
          />
  );
}
