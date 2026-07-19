import type { QueryClient } from '@tanstack/react-query';
import { depositInvoicesByProjectQueryOptions } from '@/lib/queries/invoices';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { quoteVersionsByProjectQueryOptions } from '@/lib/queries/quotes';
import type { ProjectTabModuleKey } from './projectTabModules';

export async function preloadProjectTabData(
  tab: ProjectTabModuleKey,
  context: { host: string; projectId: string; queryClient: QueryClient },
): Promise<void> {
  const { host, projectId, queryClient } = context;
  if (tab === 'estimates' || tab === 'job-packs') {
    await queryClient.prefetchQuery(estimateMetasByProjectQueryOptions(host, projectId));
    return;
  }
  if (tab === 'quotes') {
    await Promise.all([
      queryClient.prefetchQuery(estimateMetasByProjectQueryOptions(host, projectId)),
      queryClient.prefetchQuery(quoteVersionsByProjectQueryOptions(host, projectId)),
    ]);
    return;
  }
  if (tab === 'invoices') {
    await queryClient.prefetchQuery(depositInvoicesByProjectQueryOptions(host, projectId));
  }
}
