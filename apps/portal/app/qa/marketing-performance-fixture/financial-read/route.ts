import {financialPanelQuery,financialRequestKey} from '@/lib/xero/financials/contract';
import {financialProfitPartsResponse} from '@/lib/xero/financials/profitPartsResponse.server';
import {fixtureFinancialRead} from '../financialRead.server';
export async function GET(request:Request){
  if(process.env.ENABLE_PORTAL_QA_FIXTURES?.trim()!=='1'||(process.env.NODE_ENV==='production'&&process.env.VERCEL_ENV!=='preview'))return new Response(null,{status:404});
  const params=new URL(request.url).searchParams;
  const parsed=financialPanelQuery.safeParse(Object.fromEntries([...params].filter(([key])=>key!=='financeScenario')));
  if(!parsed.success||parsed.data.section!=='profit'||[...params.keys()].some(key=>params.getAll(key).length!==1))return new Response(null,{status:400});
  return financialProfitPartsResponse(request,financialRequestKey(parsed.data),async signal=>({ok:true,report:fixtureFinancialRead(parsed.data,signal,params.get('financeScenario')??'complete')}));
}
