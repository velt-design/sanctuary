'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { buildLegacyQuotePaymentSchedule } from '@/lib/quotes/paymentSchedule';
import { qk } from '@/lib/queries/keys';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { estimates, invoice, projectId, quotes, schedule } from './commercialClarityData';

/** Synthetic read-only data for the actual Commercial views; no live credentials. */
export default function CommercialClarityBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
      if (url.pathname.startsWith('/api/')) {
        return Promise.resolve(new Response(JSON.stringify({ error: 'Sample preview: server actions are unavailable. No records were changed.' }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
      }
      return originalFetch(input, init);
    };
    setReady(true);
    return () => { window.fetch = originalFetch; };
  }, []);
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } } });
    for (const host of ['fixture', supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown']) {
      queryClient.setQueryData(qk.estimates.metaByProject(host, projectId), estimates);
      queryClient.setQueryData(qk.quotes.versionsByProject(host, projectId), quotes);
      queryClient.setQueryData(qk.jobPacks.list(host, projectId), [{ id: 'pack_sample', projectId, estimateId: estimates[1].id, estimateVersionLabel: 'Louvre roof - agreed design', quoteVersionId: quotes[0].id, quoteRef: quotes[0].quoteRef, quoteVersionNumber: 3, quoteStatus: 'ACCEPTED', createdAt: '2026-09-15T01:00:00Z', createdBy: 'Sample staff' }]);
      queryClient.setQueryData(qk.invoices.byProject(host, projectId), [invoice]);
      queryClient.setQueryData(qk.invoices.scheduleByProject(host, projectId), schedule);
      for (const estimate of estimates) queryClient.setQueryData(qk.estimates.detail(host, estimate.id), {
        ...estimate, editability: { isLocked: true, lockReason: 'quote_sent', lockedAt: estimate.createdAt, lockedByQuoteVersionId: quotes[0].id, lockedByQuoteRef: quotes[0].quoteRef, lockedByQuoteVersionNumber: 3, hasDraftQuotes: false, draftQuoteCount: 0 },
        calculatorSnapshot: { inputs: {}, outputs: {
          snapshot: { contact: { displayName: 'Sample customer' }, project: { projectName: 'Sample pergola', siteAddress: 'Synthetic site' } },
          materials: { lines: [{ id: 'sample.hardware', label: 'Sample installation fixings', qty: 1, unit: 'set', total_ex_gst: 100, notes: 'Synthetic example only' }], totals: { materials_ex_gst: 100 } },
          install: { actions: [], totals: { install_ex_gst: 0 } }, overhead: { total_ex_gst: 0 }, totals: { cost_ex_gst: 100 },
        } },
      });
      for (const quote of quotes) queryClient.setQueryData(qk.quotes.detail(host, quote.id), {
        ...quote, paymentTerms: buildLegacyQuotePaymentSchedule(quote.totals.totalIncGstCents, quote.depositPercent), lineItems: [{ id: 'line_sample', description: 'Synthetic pergola supply and installation', qty: 1, unitPriceIncGstCents: quote.totals.totalIncGstCents, lineTotalIncGstCents: quote.totals.totalIncGstCents, sortOrder: 0 }], sendLogs: [], introText: '', termsText: '',
        contact: { name: 'Fixture customer', email: 'customer@example.invalid', phone: null },
        project: { name: 'Fixture project', siteAddress: 'Fixture site', region: 'Auckland', quoteRef: quote.quoteRef },
      });
    }
    return queryClient;
  });
  if (!ready) return <p role="status">Loading sample project...</p>;
  return <QueryClientProvider client={client}><div onClickCapture={(event) => {
    const anchor = (event.target as HTMLElement).closest('a[href]');
    if (!anchor) return;
    const url = new URL(anchor.getAttribute('href')!, window.location.href);
    if (!url.pathname.startsWith('/staff/')) return;
    event.preventDefault(); event.stopPropagation();
    if (url.pathname === `/staff/projects/${projectId}`) {
      url.searchParams.set('commercial', '1');
      router.push(`/qa/project-page-shell-fixture?${url.searchParams.toString()}`);
    } else setNotice('This sample covers Commercial and Job Packs. No sign-in is needed; use the tabs above.');
  }}>{notice ? <p role="status">{notice}</p> : null}{children}</div></QueryClientProvider>;
}
