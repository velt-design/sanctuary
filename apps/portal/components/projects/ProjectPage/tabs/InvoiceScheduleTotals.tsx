import { useProjectCommercialContext } from '../ProjectCommercialContext';
import { InvoiceScheduleTotalsSurface } from './InvoicesListSurface';
import type { ProjectInvoiceSchedule } from '@/lib/invoices/types';

/** Context adapter; the same pure totals owner also renders unknown public values. */
export default function InvoiceScheduleTotals({ schedule, pending = false }: { schedule: ProjectInvoiceSchedule | null; pending?: boolean }) {
  const { closed } = useProjectCommercialContext();
  return <InvoiceScheduleTotalsSurface schedule={schedule} pending={pending} closed={closed} />;
}
