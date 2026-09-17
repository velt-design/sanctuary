'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { qk } from '@/lib/queries/keys';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { estimates, invoice, projectId, quotes, schedule } from './commercialClarityData';

/** Synthetic read-only data for the actual Commercial views; no live credentials. */
export default function CommercialClarityBoundary({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } } });
    for (const host of ['fixture', supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown']) {
      queryClient.setQueryData(qk.estimates.metaByProject(host, projectId), estimates);
      queryClient.setQueryData(qk.quotes.versionsByProject(host, projectId), quotes);
      queryClient.setQueryData(qk.jobPacks.list(host, projectId), []);
      queryClient.setQueryData(qk.invoices.byProject(host, projectId), [invoice]);
      queryClient.setQueryData(qk.invoices.scheduleByProject(host, projectId), schedule);
      for (const quote of quotes) queryClient.setQueryData(qk.quotes.detail(host, quote.id), {
        ...quote, lineItems: [], sendLogs: [], introText: '', termsText: '',
        contact: { name: 'Fixture customer', email: 'customer@example.invalid', phone: null },
        project: { name: 'Fixture project', siteAddress: 'Fixture site', region: 'Auckland', quoteRef: quote.quoteRef },
      });
    }
    return queryClient;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
