import { MetricGrid } from '@/components/ui/foundation';
import type { ProjectInvoiceSchedule } from '@/lib/invoices/types';
import { useProjectCommercialContext } from '../ProjectCommercialContext';

function formatMoneyFromCents(value: number): string {
  return Number.isFinite(value) ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(value / 100) : '-';
}

/** Read-only presentation of the authoritative schedule; never sums quote versions. */
export default function InvoiceScheduleTotals({ schedule,pending=false }: { schedule: ProjectInvoiceSchedule|null;pending?:boolean }) {
  const { closed } = useProjectCommercialContext();
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
