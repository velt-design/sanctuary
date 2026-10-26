'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter,useSearchParams } from 'next/navigation';
import { buildLegacyQuotePaymentSchedule } from '@/lib/quotes/paymentSchedule';
import { qk } from '@/lib/queries/keys';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { projectStory } from '../project-command-centre-fixture/projectStories';
import { visitsFixture } from '../portal-progressive-fixture/data';
import type { ProjectCommandCentreResponse } from '@/lib/projects/commandCentre/types';
import { estimates, invoice, projectId, quotes, schedule } from './commercialClarityData';

/** Synthetic read-only data for the actual Commercial views; no live credentials. */
export default function CommercialClarityBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();const params=useSearchParams(),progressive=params.get('progressive')==='1',failure=params.get('readFailure')==='1',overview=params.get('overview')==='1';
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [{client,reads}] = useState(() => {
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
    const reads=new Map<string,{body:unknown;delay:number}>(),host='fixture';
    reads.set(`/api/projects/${projectId}/estimates`,{body:{estimates},delay:900});
    reads.set(`/api/projects/${projectId}/quotes`,{body:{quotes},delay:1200});
    reads.set(`/api/staff/v1/projects/${projectId}/job-packs`,{body:{jobPacks:queryClient.getQueryData(qk.jobPacks.list(host,projectId))},delay:1100});
    reads.set(`/api/staff/v1/projects/${projectId}/invoices`,{body:{invoices:[invoice]},delay:1200});
    reads.set(`/api/staff/v1/projects/${projectId}/invoice-schedule`,{body:{schedule},delay:650});
    reads.set(`/api/admin/projects/${projectId}/invoice-drafts`,{body:{enabled:false,drafts:[]},delay:500});
    for(const estimate of estimates){reads.set(`/api/estimates/${estimate.id}`,{body:{estimate:queryClient.getQueryData(qk.estimates.detail(host,estimate.id))},delay:1500});reads.set('/api/staff/v1/job-packs/powdercoating?estimateId='+estimate.id,{body:{overrides:{version:null,rows:[]},options:[],persistenceAvailable:false,profileOptionsAvailable:false,warningMessage:null},delay:1800});}
    for(const quote of quotes)reads.set(`/api/quotes/${quote.id}`,{body:{quoteVersion:queryClient.getQueryData(qk.quotes.detail(host,quote.id))},delay:1500});
    if(overview){
      const story=projectStory('installation'),now=new Date().toISOString();
      const design={...story.currentDesign,price:{...story.currentDesign.price,totalIncGstCents:quotes[0].totals.totalIncGstCents},quote:story.currentDesign.quote?{...story.currentDesign.quote,id:quotes[0].id,quoteRef:quotes[0].quoteRef,versionNumber:3}:null};
      const command:ProjectCommandCentreResponse={projectId,workModel:'v2',projectWork:{...story.work.projectWork,projectId},currentDesign:design,generatedAt:now,owner:{owner:{key:'jordan',displayName:'Jordan'},required:true,missing:false,version:null,permissions:{canManage:false}}};
      const correspondence={...story.correspondence,observedAt:now,sources:story.correspondence.sources.map(source=>({...source,observedAt:now})),messages:story.correspondence.messages?.map(message=>({...message,observedAt:now}))};
      const visits=visitsFixture();visits.events=visits.events.map(event=>({...event,projectId}));
      reads.set(`/api/staff/v1/projects/${projectId}/command-centre`,{body:command,delay:900});
      reads.set(`/api/staff/v1/projects/${projectId}/correspondence`,{body:{state:'ready',context:correspondence},delay:1100});
      reads.set('/api/staff/v1/outlook-site-visits',{body:visits,delay:1200});
    }
    if(progressive)queryClient.clear();
    return {client:queryClient,reads};
  });
  useEffect(() => {
    const originalFetch = window.fetch;
    const failed=new Set<string>();
    window.fetch = async(input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
      if (url.pathname.startsWith('/api/')) {
        const method=init?.method??(input instanceof Request?input.method:'GET');
        const key=url.pathname+(url.pathname.endsWith('/powdercoating')?'?estimateId='+url.searchParams.get('estimateId'):'');
        const read=reads.get(key);
        if((progressive||overview)&&method.toUpperCase()==='GET'&&read){
          const signal=init?.signal??(input instanceof Request?input.signal:undefined);
          await new Promise<void>((resolve,reject)=>{if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}const timer=setTimeout(resolve,read.delay);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
          if(failure&&!failed.has(key)){failed.add(key);return Response.json({error:'Synthetic read failure. Retry the same fictional source.'},{status:503});}
          return Response.json(read.body);
        }
        return Promise.resolve(new Response(JSON.stringify({ error: 'Sample preview: server actions are unavailable. No records were changed.' }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
      }
      return originalFetch(input, init);
    };
    setReady(true);
    return () => { window.fetch = originalFetch; };
  }, [progressive,failure,overview,reads]);
  if (!ready) return <p role="status">Loading sample project...</p>;
  return <QueryClientProvider client={client}>{progressive&&<p>Controlled fictional reads: schedule650 ms, lists900–1200 ms, detail1500 ms, powdercoating overrides1800 ms. Every server command and unlisted API request is rejected. The actual Commercial queries and owners are used.</p>}<div onClickCapture={(event) => {
    const anchor = (event.target as HTMLElement).closest('a[href]');
    if (!anchor) return;
    const url = new URL(anchor.getAttribute('href')!, window.location.href);
    if (!url.pathname.startsWith('/staff/')) return;
    event.preventDefault(); event.stopPropagation();
    if (url.pathname === `/staff/projects/${projectId}`) {
      url.searchParams.set('commercial', '1');
      if(progressive)url.searchParams.set('progressive','1');
      if(failure)url.searchParams.set('readFailure','1');
      if(overview)url.searchParams.set('overview','1');
      router.push(`/qa/project-page-shell-fixture?${url.searchParams.toString()}`);
    } else setNotice('This sample covers Commercial and Job Packs. No sign-in is needed; use the tabs above.');
  }}>{notice ? <p role="status">{notice}</p> : null}{children}</div></QueryClientProvider>;
}
