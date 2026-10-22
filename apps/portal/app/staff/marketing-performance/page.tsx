import MarketingPerformance from '@/components/marketingPerformance/MarketingPerformance';
import { notFound } from 'next/navigation';
import { requireStaffPageAccess } from '@/lib/auth';
import { isDeveloper } from '@/lib/developerAccess';
import { headers } from 'next/headers';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { overviewDocumentWindow, financialDocumentQuery } from '@/lib/marketingPerformance/reportDocumentSelection';
import { readCommercial, readDesigner, overviewFailure } from '@/lib/marketingPerformance/readOverview.server';
import { financialRequestKey } from '@/lib/xero/financials/contract';
import { readPortalFinancials, financialReadFailure } from '@/lib/xero/financials/readPortal.server';
import { hubDocumentWindow } from '@/lib/marketingPerformance/hubDocumentSelection';
import { readHub, hubReadFailure } from '@/lib/marketingPerformance/readHub.server';
import { getDocumentRenderDiagnostics } from '@/lib/performance/documentRenderDiagnostics';
import { columnarRead } from '@/lib/marketingPerformance/columnarReports';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export default async function MarketingPerformancePage() {
  const session = await requireStaffPageAccess('/staff/marketing-performance');
  if (!isDeveloper(session.user)) notFound();
  const snapshot=process.env.MARKETING_PERFORMANCE_PREVIEW==='production-snapshot';
  if(snapshot&&process.env.VERCEL_ENV!=='preview')notFound();
  const context=new Headers(await headers());
  const window = hubDocumentWindow(context);
  const overview=snapshot?null:overviewDocumentWindow(context);
  const financial=snapshot?null:financialDocumentQuery(context);
  const diagnostics=overview?await getDocumentRenderDiagnostics():null;
  const observe=<T extends {ok:boolean}>(phase:'marketing.hub'|'marketing.commercial'|'marketing.designer',read:()=>Promise<T>)=>
    diagnostics?diagnostics.measure(phase,read,result=>result.ok?'complete':'error'):read();
  const client=window?getSupabaseServerAuth():undefined;
  const initialHubSeed = window ? { ...window,
    result: observe('marketing.hub',()=>client!.then(client => readHub(client, window.start, window.end)).then(result=>columnarRead('hub',result)).catch(hubReadFailure)) } : undefined;
  const initialCommercialSeed=overview?{key:`${overview.start}:${overview.end}`,result:observe('marketing.commercial',()=>client!.then(client=>readCommercial(client,overview.start,overview.end)).then(result=>columnarRead('commercial',result)).catch(()=>overviewFailure('Commercial')))}:undefined;
  const initialDesignerSeed=overview?{key:`${overview.start}:${overview.end}`,result:observe('marketing.designer',()=>client!.then(client=>readDesigner(client,overview.start,overview.end)).then(result=>columnarRead('designer',result)).catch(()=>overviewFailure('Designer')))}:undefined;
  const initialFinancialSeed=financial?{key:financialRequestKey(financial),result:readPortalFinancials(new URLSearchParams(financial),AbortSignal.timeout(45000),session.user.id).catch(financialReadFailure)}:undefined;
  return <MarketingPerformance staging={process.env.MARKETING_PERFORMANCE_PREVIEW === 'staging'} productionSnapshot={snapshot}
    initialHubSeed={initialHubSeed} initialCommercialSeed={initialCommercialSeed} initialDesignerSeed={initialDesignerSeed} initialFinancialSeed={initialFinancialSeed}
    previewDescription={snapshot?'Private production snapshot · Real records from 23 September 2025 through 22 September 2026; outcomes frozen at the read time below. Refresh rereads this snapshot. Project links open the live Portal; other preview pages use staging records.':undefined}/>;
}
