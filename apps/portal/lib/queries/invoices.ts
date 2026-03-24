import { queryOptions } from '@tanstack/react-query';
import { listProjectDepositInvoices } from '@/lib/repo/invoicesRepo';
import { qk } from './keys';

const ONE_DAY = 1000 * 60 * 60 * 24;
const TEN_MINUTES = 1000 * 60 * 10;

export const depositInvoicesByProjectQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.invoices.byProject(host, projectId),
    queryFn: () => listProjectDepositInvoices(projectId),
    staleTime: TEN_MINUTES,
    gcTime: ONE_DAY,
  });

