import { notFound } from 'next/navigation';
import Fixture from './Fixture';
import { hubFixture } from './hubFixtures';
import { representativeFixture, representativeFilters } from './representativeFixture';
import { fixtureFilters } from './fixtures';
import { commercialFixture } from './commercialFixtures';
import { designerFixture } from './designerFixtures';
import {fixtureFinancialRead} from './financialRead.server';
import {financialProfitSeed} from '@/lib/xero/financials/financialSeed.server';
import { sampleFinancialPanel } from './financialFixtures';
import { aucklandDay } from '@/lib/marketingPerformance/contract';
import { selectionFromUrl, financialRequestKey } from '@/lib/xero/financials/contract';
import { columnarRead, type ColumnarKind } from '@/lib/marketingPerformance/columnarReports';
import type { ReportRead } from '@/lib/marketingPerformance/reportRead';

export default async function MarketingPerformanceFixture({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  if ((process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview') || process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() !== '1') notFound();
  const query=await searchParams,representative=query.representative==='1';
  if(query.progressive!=='1')return <Fixture representative={representative}/>;
  const params=new URLSearchParams(Object.entries(query).flatMap(([key,value])=>typeof value==='string'?[[key,value]]:[]));
  const base=representative?representativeFixture:hubFixture, defaults=representative?representativeFilters:fixtureFilters;
  const filters={...defaults,start:params.get('start')??defaults.start,end:params.get('end')??defaults.end};
  const hub={...base,start:filters.start,end:filters.end,enquiries:{...base.enquiries,start:filters.start,end:filters.end,rows:base.enquiries.rows.filter(row=>{const day=aucklandDay(new Date(row.receivedAt));return day>=filters.start&&day<=filters.end;})},events:base.events.filter(row=>row.day>=filters.start&&row.day<=filters.end)};
  const commercial=commercialFixture(hub,filters),designer={...designerFixture(typeof query.designerScenario==='string'?query.designerScenario:'accepted',hub),start:filters.start,end:filters.end};
  async function seed<T>(kind:ColumnarKind,report:T,delay:number) {
    await new Promise(resolve=>setTimeout(resolve,delay));
    if((kind==='hub'&&query.failure==='1')||(kind==='commercial'&&query.commercialFailure==='1'))return {ok:false as const,status:503 as const,error:'Synthetic report failure. No customer system contacted.'};
    if(kind==='hub'&&query.denied==='1')return {ok:false as const,status:403 as const,error:'Synthetic access denial. No customer system contacted.'};
    return columnarRead(kind,{ok:true,report});
  }
  const enabled=query.view!=='financials',overview=enabled&&(!query.view||query.view==='overview'),key=filters.start+':'+filters.end;
  const financial=selectionFromUrl(params);
  const financialQuery={from:financial.from,to:financial.to,basis:financial.basis,section:financial.section};
  const financialSeed:Promise<ReportRead<ReturnType<typeof sampleFinancialPanel>>>|undefined = !enabled&&financialQuery.section!=='profit'?new Promise(resolve=>setTimeout(()=>resolve(params.get('financeScenario')==='failure'?{ok:false,status:503,error:'Synthetic source failure. Choose complete reports and Retry.'}:{ok:true,report:sampleFinancialPanel(financialQuery,params.get('financeScenario')??'complete')}),1600)):undefined;
  return <Fixture representative={representative} initialQuery={params.toString()}
    initialHubSeed={enabled?{...filters,result:seed('hub',hub,2400)}:undefined}
    initialCommercialSeed={overview?{key,result:seed('commercial',commercial,500)}:undefined}
    initialDesignerSeed={overview?{key,result:seed('designer',designer,1100)}:undefined}
    initialFinancialSeed={!enabled?(financialQuery.section==='profit'?financialProfitSeed(financialRequestKey(financialQuery),Promise.resolve({ok:true,report:fixtureFinancialRead(financialQuery,AbortSignal.timeout(45000),params.get('financeScenario')??'complete')})):{key:financialRequestKey(financialQuery),result:financialSeed!}):undefined}/>;
}
